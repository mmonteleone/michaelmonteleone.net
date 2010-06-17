// setup the main app code
jQuery(function($){    
    $.colorScrubber({
        rawSource: $.query.q
    });
});

/* main app plugin */
(function($){
    $.colorScrubber = function(options) {
        var settings = $.extend({}, $.colorScrubber.defaults, options || {});
        
        var scrubButton = $(settings.scrubButton),
            sourceInput = $(settings.sourceInput),
            colorList = $(settings.colorList),
            message = $(settings.message),
            scrubbingIndicator = $(settings.scrubbingIndicator),
            permaLink = $(settings.permaLink),
            scrubbingEvent = 'scrubbing',
            scrubbedEvent = 'scrubbed',
            invalidUrl = 'invalidUrl',
            noSourceEvent = 'nosource';
            
        // decorate the source textbox with default text and auto-resizing abilities
        sourceInput.flextarea().defaultText();

        // set up main ui event handlers to modify the page when things happen
        $(document)
            // show the in-progress indicator while scrubbing...
            .bind(scrubbingEvent, function(e, data) {
                colorList.clearColors();
                scrubButton.hide();
                scrubbingIndicator.css({display: 'block'});
                message.text("");
                permaLink.hide();                
            })
            // when scrubbing is complete, show its output properly...
            .bind(scrubbedEvent, function(e, data) {
                scrubButton.show();
                scrubbingIndicator.hide();
                // if there was actual data returned...
                if(!!data) {
                    
                    // render the colors 
                    colorList.renderColors(data.colors);
                    
                    // show an appropriate message about how many colors were found
                    if(data.colors.length === 0) {
                        message.text("The source doesn't seem to contain any color information.");                  
                    } else {
                        message.text("I found {n} color{s} in the source."
                            .replace(/\{n\}/, data.colors.length)
                            .replace(/\{s\}/, data.colors.length > 1 ? 's' : ''));                                        
                    }
                    
                    // generate and display a permalink to the results
                    
                    // if content was generated via url, permalink it to re-use url again
                    if(!!data.url) {
                        permaLink.attr('href', window.location.pathname + "?q=" + encodeURIComponent(data.url));
                    // otherwise, make a permalink which passes in a joined string of all the parsed colors from the raw
                    // content, but not the entire raw content, since it could possibly exceed the max querystring length.
                    // the color list could too, but much less likely
                    } else {
                        var colorString = $.map(data.colors, function(i){ return '#' + i.hexString; }).join(' ');
                        permaLink.attr('href', window.location.pathname + "?q=" + encodeURIComponent(colorString));
                    }
                    permaLink.show();
                }
            })
            .bind(invalidUrl, function(e, data) {
                scrubButton.show();
                scrubbingIndicator.hide();
                message.text("Woops, I can't scrub that URL!");
                permaLink.hide();                
            })
            .bind(noSourceEvent, function(e, data) {
                scrubButton.show();
                scrubbingIndicator.hide();              
                message.text("Woops, you didn't provide any source to scrub!");
                permaLink.hide();                
            });
        
        // set up main ui event-emitting core stuff...
        var processSource = function(source) {
            // if source looked like a url, load it up
            if(settings.rurl.test(source)) {
                $(document).trigger(scrubbingEvent);
                // hey, thanks yahoo! for the free client-side cross-domain requests
                $.getJSON("http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22" +
                    encodeURIComponent(source) + "%22&format=xml'&callback=?",
                    function(data) {
                        if (data.results[0]) {
                            $(document).trigger(scrubbedEvent, {colors: $.parseColors(data.results[0]), url: source});
                        } else {
                            $(document).trigger(invalidUrl);
                        }
                    });
            // otherwise, just process the raw text source content
            } else {
                $(document).trigger(scrubbingEvent);
                // if source was empty or the default placeholder text...
                if(source === '' || source === sourceInput.attr('data-defaultvalue')) {
                    $(document)
                        .trigger(scrubbedEvent)
                        .trigger(noSourceEvent);
                } else {
                    $(document)
                        .trigger(scrubbingEvent)
                        .trigger(scrubbedEvent, {colors: $.parseColors(source)});                   
                }
            }            
        };        

        // run parser and render colors when clicked
        $(scrubButton).bind('click', function(){
            processSource($.trim($(sourceInput).val()));
            return false;
        });    
                
        // if plugin asked to render an explicit source passed in via the rawSource option...
        if(!!settings.rawSource && settings.rawSource.length > 0) {
            // trigger the 'customText' event so that the defaultText plugin thinks it's been actually interacted with
            sourceInput.trigger('customText').val(settings.rawSource);
            // go ahead and process the source
            processSource(settings.rawSource);
        }
    };
    $.extend($.colorScrubber, {
        defaults: {
            rurl: /^(file|https?):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/i,
            scrubButton: '#scrub',
            sourceInput: '#source',
            scrubbingIndicator: '#scrubbing',
            message: '#message',
            colorList: 'ul#colors',
            permaLink: '#permalink',
            rawSource: '' // if provided, will go ahead and process this source value
        }
    });
})(jQuery);


/**
 * jQuery plugin which exposes a single method:
 * var uniqueColors = $.colorScrub(rawText)
 * which accepts raw input text and returns an object
 * containing unique Colors mentioned in raw input
 */
(function($, global){

    /**
     * Collection of conversion helpers
     */
    var Convert = {
        /**
         * Converts a hex string to a Number
         * @param {String} raw string represntation of hex color as 3 or 6 characters
         * (EEE is first converted to EEEEEE)
         */
        stringToHex: function(raw) { 
            // if passed a 3-character value, convert to 6 character
            if(raw.length === 3) {
                var doubled = "";
                for(var i=0;i<3;i++) {
                    doubled += raw.charAt(i);
                    doubled += raw.charAt(i);
                }
                raw = doubled;
            }
            // convert to numeric representation of hex color
            return parseInt(raw, 16);
        },
        /**
         * Converts a number to its base-16 string value
         * Left-Pads with 0 when result is less than 6 characters
         * @param {Number} hex Number to convert to base-16 string
         */
        hexToString: function(hex) {
            var converted = hex.toString(16);
            while(converted.length < 6) {
                converted = '0' + converted;
            }
            return converted;
        },
        /**
         * Converts a hex value into an RGB object with r,g,b properties 
         * each with values of 0-255
         * @param {Number} hex Raw value to convert to an RGB object
         */
        hexToRgb: function(hex) {
            var hexString = Convert.hexToString(hex);
            return {
                r: parseInt(hexString.substring(0,2), 16),
                g: parseInt(hexString.substring(2,4), 16),
                b: parseInt(hexString.substring(4,6), 16)
            };
        }
    };

    /**
     * Simple Color class.  Instantiated via a hex number
     * Exposes properties
     *      hex         Number
     *      hexString   String
     *      r           Number
     *      g           Number
     *      b           Number
     * @param {Number|String} hex Either a hex string or number value
     */
    var Color = function(hex) {
        hex = typeof hex === 'string' ? Convert.stringToHex(hex) : hex;
        $.extend(this, {
            hex: hex,
            hexString: Convert.hexToString(hex)      
        });
        $.extend(this, Convert.hexToRgb(hex));
    };

    /**
     * Given a raw text input, finds all color content
     * mentioned in the text and returns an object containing
     * all uniquely mentioned colors as Color objects
     */
    var scrub = function(raw) {
        var foundColors = {},
            foundColorsList = [];
        // run each scraper's regex against the source
        $.each(scrub.scrapers, function(regex, processor){
            // for each raw color text, run the scraper's processor to 
            // generate a Color object and add it to the set of foundColors
            var matches = raw.match(new RegExp(regex,'igm'));
            if(matches !== null) {
                $.each(matches, function(i, match) { 
                    var color = processor(match); 
                    foundColors[color.hexString] = color;
                });
            }
        });
        $.each(foundColors, function(i, item) {
            foundColorsList.push(item);
        });
        return foundColorsList;
    };
    /**
     * Extends the scrub function with a set of all regex matchers
     * each matcher has an associated function which should return a Color object
     * from parsing a single match found by its regex
     */
    $.extend(scrub, {
        scrapers: {
            "#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})": function(raw) {
                raw = raw.replace(/^#+/,'');
                return new Color(raw);
            },
            "0x[0-9a-fA-F]{6}": function(raw) { 
                raw = raw.replace(/^0x+/,'');
                return new Color(raw);
            },
            "0x0(0|1|2)[0-9a-fA-F]{6}": function(raw) { 
                raw = raw.replace(/^0x0(0|1|2)/,'');
                return new Color(raw);
            }
        }    
    });

    // expose color scraper
    $.parseColors = scrub;

})(jQuery, window);



/**
 * Color-rendering plugin.  
 * $('ul#colors').renderColors(objectOfColors);
 */
(function($){
    $.fn.extend({
        renderColors: function(colors, options) {
            var selection = this,
                settings = $.extend({}, $.fn.renderColors.defaults, options || {});
            var lineTemplate = $(settings.template);

            // empty the current colors
            this.clearColors();
            // ad all the new ones
            $.each(colors, function(i, color){
                lineTemplate.clone()
                    .first('li').css({backgroundColor:'#'+color.hexString}).end()
                    .find('input.h').val(color.hexString).end()
                    .find('input.r').val(color.r).end()
                    .find('input.g').val(color.g).end()
                    .find('input.b').val(color.b).end()
                    .appendTo(selection);
            }); 
            
            this.animate({opacity: 1},{duration: 300});
            
            return selection;            
        },
        clearColors: function() {
            return this.empty().css({opacity: 0});
        }        
    });
    $.extend($.fn.renderColors, {
        defaults: {
            template: '<li class="color">' +
                            '<div>' +
                                '<label>#</label>' +
                                '<input type="text" class="h" value="" />' +
                                '<label>r</label>' +
                                '<input type="text" class="r" value="" />' +
                                '<label>g</label>' +
                                '<input type="text" class="g" value="" />' +
                                '<label>b</label>' +
                                '<input type="text" class="b" value="" />' +
                            '</div>' +
                        '</li>',
            defaultContainer: 'ul#colors'
        }
    });

    /* apply some nice live-bound effects to rolling over/interacting with rendered colors */
    /* these are bound live for efficiency but could be moved into the plugin itself for more flexibility */
    $(function(){
        $($.fn.renderColors.defaults.defaultContainer)
            .delegate('input', 'mouseenter', function(){
                $(this).fadeTo(100, 1).select();
            })
            .delegate('input', 'mouseleave', function(){
                $(this).fadeTo(200, 0.3);
            })
            .delegate('li', 'mouseenter', function(){
                $(this).find('label').fadeTo(100, 1).end()
                       .find('input').fadeTo(100, 0.5);
            })
            .delegate('li', 'mouseleave', function(){
                $(this).find('label').fadeTo(200, 0.3).end()
                       .find('input').fadeTo(200, 0.3);
            });
    });
})(jQuery);



/* general plugins */


/**
 * jQuery.flextarea
 */
(function($){       
    var contextKey = '_flextarea_context',
        currentJqSupportsLive = Number($.fn.jquery.split('.').slice(0,2).join('.')) >= 1.4,
        minHeightAttr = 'data-minheight',
        maxHeightAttr = 'data-maxheight',
        minRowsAttr = 'data-minrows',
        maxRowsAttr = 'data-maxrows';
        
    $.fn.extend({
        flextarea: function(options) {
            var settings = $.extend({}, $.fn.flextarea.defaults, options || {}),
                selection = this,
                measureDivContainer,
                sharedMeasureDiv = null,
                binder = settings.live ? 'live' : 'bind',
                captureTextStyles = function(textarea) {
                    var styles = {};
                    $.each(settings.styles, function(){
                        var styleName = String(this);
                        styles[styleName] = textarea.css(styleName);
                    });
                    return styles;
                },
                constructMeasureDiv = function(textarea) {
                    measureDivContainer = measureDivContainer || 
                        $('<div class="flextarea-measurediv-container"></div>')
                            .css({ position: 'absolute', left: '-50000px', top: '-50000px' })
                            .appendTo($('body'));

                    return $('<div></div>')
                        .css($.extend({}, captureTextStyles(textarea), {
                                display: 'none',
                                width: textarea.css('width')
                            }))
                        .appendTo(measureDivContainer);
                },
                rowsToHeight = function(measureDiv, rows) {
                    var blankRows = '';
                    for(var i = 1; i < rows; i++){
                        blankRows += '<br />&nbsp;';
                    }
                    measureDiv.html(blankRows);
                    return measureDiv.height();
                },
                buildAndAttachContext = function(text) {
                    if(text.data(contextKey) === undefined || text.data(contextKey) === null) {
                        var context = $.extend({},settings);
                    
                        if(settings.shareMeasure) {
                            sharedMeasureDiv = sharedMeasureDiv || constructMeasureDiv(text, settings.styles);
                            context.measureDiv = sharedMeasureDiv;
                        } else {
                            context.measureDiv = constructMeasureDiv(text, settings.styles);
                        }
                        
                        // give preference to any explicitly-defined HTML5 data attributes 
                        // directly on the elements for defining the min/max heights/rows 
                        context.minRows = text.attr(minRowsAttr) || context.minRows;
                        context.minHeight = text.attr(minHeightAttr) || context.minHeight;
                        context.maxRows = text.attr(maxRowsAttr) || context.maxRows;
                        context.maxHeight = text.attr(maxHeightAttr) || context.maxHeight;
                        
                        context.minHeight = context.minRows !== null ? 
                            rowsToHeight(context.measureDiv, context.minRows) : 
                            context.minHeight;
                        context.maxHeight = context.maxRows !== null ? 
                            rowsToHeight(context.measureDiv, context.maxRows) : 
                            context.maxHeight;                        
                            
                        text.data(contextKey, context);
                    }
                };
                
            if(!currentJqSupportsLive && settings.live) {
                throw("Use of the live option requires jQuery 1.4 or greater");
            }
            
            var resizeHandler = function(e){
                    var text = $(e.target);
                    buildAndAttachContext(text);
                    text.flextareaResize();
            };
            
            $.each('keyup change maxlength'.split(' '), function(){
                selection[binder](String(this), resizeHandler);
            });
            selection[binder]('paste', function(e) {
                setTimeout(function(){
                    resizeHandler(e);
                },1);
            });
                        
            // if jQuery.confine is loaded, automatically apply it too
            if($.fn.confine !== undefined) {
                selection.confine({maxlength: settings.maxLength});
            }
                
            return selection
                .each(function(){ buildAndAttachContext($(this)); })
                .flextareaResize();
        },
        
        flextareaResize: function() {            
            return this.each(function(){
                var textarea = $(this),
                    text = textarea.val(),
                    context = textarea.data(contextKey);                
                    
                if(context !== undefined) {
                    context.measureDiv.html(text.replace(/\n/g,'<br />')
                        .replace(/\s\s/g, ' &nbsp;') + context.padWord);

                    var newStyle = {overflow: 'hidden'},
                        currentHeight = textarea.height(),
                        newHeight = context.measureDiv.height();

                    if(newHeight < context.minHeight) {
                        newStyle.overflow = 'hidden';
                        newHeight = context.minHeight;
                    } else if (newHeight >= context.maxHeight) {
                        newStyle.overflow = 'auto';
                        newHeight = context.maxHeight;
                    }

                    if(newHeight != currentHeight) {
                        newStyle.height = newHeight + 'px';
                        textarea.css(newStyle);

                        textarea.trigger('resize');
                        if(newHeight > currentHeight) {
                            textarea.trigger('grow');
                        } else if(newHeight < currentHeight) {
                            textarea.trigger('shrink');
                        }
                    }                
                }                    
            });    
        }
    });
    
    $.flextarea = function(options) {
        $($.fn.flextarea.defaults.selector).flextarea(options);                        
    };
    
    $.extend($.fn.flextarea, {
        version: '0.9.0',
        defaults: {
            styles: [
                'border-top-width','border-top-style','border-bottom-width',
                'border-bottom-style','border-right-width','border-right-width-value',
                'border-right-style','border-right-style-value','border-left-width',
                'border-left-width-value','border-left-style','border-left-style-value',
                'font-family','font-size','font-size-adjust','font-stretch',
                'font-style','font-variant','font-weight','padding-bottom',
                'padding-left','padding-right','padding-top','letter-spacing',
                'line-height','text-align','text-indent','word-spacing' ],
            minHeight: 0,
            maxHeight: 999999,
            minRows: null,
            maxRows: null,
            maxLength: null,
            shareMeasure: false,
            padWord: ' MMMMMMMM',
            // defaults to live handling when in jq 1.4
            live: currentJqSupportsLive,
            selector: 'textarea'
        }        
    });
    
})(jQuery);



/**
 * Simple little query string jQuery plugin
 * usage:
 * var value = $.query['key']
 * if given key has no value passed with it, value of key is simply 'true'
 */
(function($){
    var raw = window.location.search;
    $.query = {};
    $.each(raw.substring(1, raw.length).split('&'), function(i, item){
        $.query[item.split('=')[0]] = decodeURIComponent(item.split('=')[1]) || true;    
    });
})(jQuery);



/**
 * Simple plugin for showing default text in a textarea
 * Uses the default text value specified by html5 property 'data-defaultvalue'
 * usage:
 *   $('textarea,input[type="text"]').defaultText();
 * events:
 *   'customText' - raised when input no longer has default content
 *   'defaultText' - raised when input set to default content
 * options:
 *   defaultClass - css class to apply whenever the input contains default text
 */
(function($){
    $.fn.defaultText = function(options) {
        var settings = $.extend({}, $.fn.defaultText.defaults, options || {});
        return this.each(function(){
            var empty = '', 
                textarea = $(this);
            var defaultValue = textarea.attr(settings.defaultAttribute);
            if(defaultValue !== null) {
                textarea
                    .bind(settings.customEvent, function(){
                        textarea
                            .removeClass(settings.defaultClass)
                            .val(empty);
                    })
                    .bind(settings.defaultEvent, function(){
                        textarea
                            .addClass(settings.defaultClass)
                            .val(defaultValue);
                    })
                    .focus(function(){
                        if(textarea.val() === defaultValue) {
                            textarea.trigger(settings.customEvent);
                        }                
                    })
                    .blur(function(){
                        if(textarea.val() === empty) {
                            textarea.trigger(settings.defaultEvent);
                        }                                                
                    });
                if(textarea.val() === empty || textarea.val() === defaultValue) {
                    textarea.trigger(settings.defaultEvent);
                }
            }
        });
    };
    $.extend($.fn.defaultText, {
        defaults: {
            customEvent: 'customText',
            defaultEvent: 'defaultText',
            defaultAttribute: 'data-defaultvalue',
            defaultClass: 'default'
        }
    });
})(jQuery);


