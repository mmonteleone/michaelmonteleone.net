---
title: Proxying ASP.NET AJAX events with jQuery
tags:  []
layout: post
description: Proxying ASP.NET AJAX events with jQuery Special Events
comments: true
---

[MVC](http://www.asp.net/mvc) is great, but ASP.NET *remains*.  Web Forms walk *amongst us*.  Not alive, *not dead*.  (Not even [LINQ to SQL-Dead](http://blogs.msdn.com/b/adonet/archive/2008/10/29/update-on-linq-to-sql-and-linq-to-entities-roadmap.aspx).)  William Faulkner, *who never maintained a legacy ASP.NET codebase*, gets it right:

> The past is never dead. It's not even past.

But as code has grown, so have tools for its manipulation.  jQuery excels here.  It's *great* for bulk-shoveling client-side mass.  

*Here we'll see an example of this by proxying ASP.NET AJAX's client-side events as native jQuery events using jQuery's Special Event API and some fancy JavaScript meta-programming.*

## Scenario

So, you're faced with an [UpdatePanel](http://msdn.microsoft.com/en-us/library/system.web.ui.updatepanel.aspx) and need to post-process its results.  Maybe you want to reveal the UpdatePanel's response through an animation.  Sure, you could use the ASP.NET AJAX Control Toolkit, but maybe you're already using jQuery, having learned that the toolkit's server-side savings tend to cost you on the client, or maybe you want to do something deeper like re-wiring the response's particular content with other client-side logic.

Ideally, you could get by with jQuery [event delegation](http://api.jquery.com/delegate/), but maybe it's just out of practical bounds in your scenario.  So, it's back to tying directly into ASP.NET AJAX's client side code.  

Here's how you could do it by the book:

{% highlight javascript %}
// add an event handler to fire when the UpdatePanel is done
Sys.WebForms.PageRequestManager.getInstance().add_endRequest(function(sender, args) {
    // and then process DOM content which is there as a result of the update
    $('div.someclass').show('slow');
});
{% endhighlight %}

But you're using jQuery, and the impedance mismatch and explicit dependence on the AJAX toolkit is less than pleasant.  Paraphrasing [Rob](http://blog.wekeroad.com/), "impedance mismatch is death by a thousand cuts."  You'd probably prefer:

{% highlight javascript %}
$(document).bind('atlasEndRequest', function(){
    $('div.someclass').show('slow');    
});
{% endhighlight %}

## Solution

That's easy to allow for with the aid of jQuery Special Events.  Many people tend to equate jQuery plugins with with extending the `jQuery.fn` object, but fewer are familiar with extending jQuery's events via the Special Events API.  Though [much](http://benalman.com/news/2010/03/jquery-special-events/) [has](http://brandonaaron.net/blog/2009/03/26/special-events) [been](http://brandonaaron.net/blog/2009/06/4/jquery-edge-new-special-event-hooks) [written](http://brandonaaron.net/blog/2010/02/25/special-events-the-changes-in-1-4-2) about the Special Events API, I've found it easiest to understand as simply a mechanism for executing code *upon the actual binding or unbinding* of a given event.  

So, `$(document).bind('atlasEndRequest', function(){...})` is not only binding a callback to a custom event, it's also setting up background logic to properly *raise* the *atlasEndRequest* custom event when necessary.

{% highlight javascript %}
jQuery.event.special.atlasEndRequest = {
    // following happens the first time 'atlasUpdateEvent' is bound on a selection
    setup: function () { 
        // have the PageRequestManager raise a jQuery-native event named
        // 'atlasEndRequest' in its callback
        Sys.WebForms.PageRequestManager.getInstance()
            .add_endRequest(function(s, args) {
                jQuery(document).trigger('atlasEndRequest', { sender: s, args: args });
            });
    }
};
{% endhighlight %}

This will work as-is.  But special events can also have code run upon the last unbind of an event from a selection with `teardown`, or (new in 1.4) upon *each* bind and unbind of an event from a selection with `add` and `remove`.  And the [PageRequestManager](http://msdn.microsoft.com/en-us/library/bb311028.aspx) gives us [more possibly-useful events](http://msdn.microsoft.com/en-us/library/bb384136.aspx) (initializeRequest, beginRequest, endRequest, pageLoading, pageLoaded) we might want to proxy as well.  So, with a little bit of fancy meta-programming, we can support all of them, along with proper unbinding.

{% highlight javascript %}
(function ($) {
    // list of all events this will wrap
    var events = 'initializeRequest beginRequest endRequest pageLoading pageLoaded';
    $.each(events.split(' '), function (i, name) {
        // make a new camel-cased public 'atlas*' name for the event
        var mappedName = 'atlas'+name.substring(0, 1).toUpperCase()+name.substring(1),
            // build a callback for PageRequestManager's event
            handler = function (sender, args) {
                $(document).trigger(mappedName, { sender: sender, args: args });
            };
       
        // Whenever the atlas* event is first bound or last unbound,
        // set up the callback with the PageRequestManager's version of the event
        $.event.special[mappedName] = {
            setup: function () { requestManage('add_' + name, handler); },
            teardown: function () { requestManage('remove_' + name, handler); }
        };

        // also build a shortcut jquery plugin method for the event
        $.fn[mappedName] = function (fn) {
            return fn ? this.bind(mappedName, fn) : this.trigger(mappedName);
        };
    });

    /**
     * Calls a given event-handling setup method on the PageRequestManager
     * if there currently is one.  Rewrites self to save performance on subsequent
     * calls.
     * @param {String} method The name of the method to call on the PageRequestManager
     * @param {Function} handler callback to pass as arg to the method
     */
    var requestManage = function (method, handler) {
        var prm = 'Sys' in window && 'WebForms' in window.Sys &&
                'PageRequestManager' in window.Sys.WebForms ?
                Sys.WebForms.PageRequestManager.getInstance() : null,
           bind = function (method, handler) {
                if (prm !== null) {
                    prm[method](handler);
                }
            };
        // go ahead and bind 
        bind(method, handler);
        // reassign this function for subsequent calls,
        // to not unnecessarily rebuild bind and prm items
        // this creates a closure over the current prm and bind
        requestManage = function (method, handler) {
            bind(method, handler);
        };
    };
})(jQuery);
{% endhighlight %}

A bit of code, but dig in.  You're smart.  And two extra credit points:

It provides shortcut methods for binding and triggering the events, so 

{% highlight javascript %}
$('document').bind('atlasEndRequest', function(){ 
    console.log('update complete!');
});
{% endhighlight %}

*is aliased*

{% highlight javascript %}
$('document').atlasEndRequest(function(){
    console.log('update complete!');    
});
{% endhighlight %}

And it uses some fanciness with a self-reassigning-function to ensure that absence of the Sys.WebForms.PageRequestManager will not break the plugin, and getting its instance will only necessarily be called once.  It's a micro-optimization for sure, but still a fun example.

If you are still interested in the `sender` and `args` parameters passed back from the PageRequestManager to its event handler, those are still exposed via the optional `data` parameter.

{% highlight javascript %}
$('document').bind('atlasEndRequest', function(e, data){ 
    console.log(data.args);
    console.log(data.sender);
});
{% endhighlight %}

Even if you don't find this particularly useful or practical, hopefully it opens your mind to JavaScript's yoga-like flexibility.  [\_why](http://rubyforge.org/pipermail/camping-list/2008-May/000719.html):

> Not all code needs to be a factory, some of it can just be origami.

You can grab this plugin along with its small test suite from [GitHub](http://github.com/mmonteleone/jquery.updatepanel).