---
title: Suspiciously Pleasant XML with C# 4
tags:  []
layout: post
description: Using c# 4 type dynamic to simulate Ruby's XML Builder API
comments: true
---

So it goes with the digestive processes of programming trends, and dynamic delegation has reached the crowded mainland shores of the .NET Framework in the form of C# 4's [dynamic](http://msdn.microsoft.com/en-us/library/dd264736.aspx) type.  Though it was nothing new even *then*, six years ago many of us got our first hit of dynamic delegation through Ruby metaprogramming in Rails.  The very notion that something like this: 

{% highlight ruby %}
class User < ActiveRecord::Base; end
{% endhighlight %}

was enough to provide a rich API over a `users` database table supporting calls like the following was mind-opening at the time.

{% highlight ruby %}
users = User.find_all_by_state("TX")
user = User.find_or_create_by_email("foo@bar.com")
{% endhighlight %}

Really?  Yep, with Ruby's [`method_missing`](http://weblog.jamisbuck.org/2006/12/1/under-the-hood-activerecord-base-find-part-3).  

But the caffeine wears off, you buy a house in the suburbs, and you have to debug your fancy meta-code.  JRuby core developer, Ola Bini [writes](http://olabini.com/blog/2010/04/patterns-of-method-missing/):

> In almost all cases you think you need `method_missing`, you actually don’t.

C#? XML?
--------

Hold tight.  

When he used to exist, [\_why](http://en.wikipedia.org/wiki/Why_the_lucky_stiff) [wrote](http://www.artima.com/forums/flat.jsp?forum=123&thread=92365#122911) regarding Ruby's `method_missing`:

> I never use `method_missing`. Maybe twice. And both times I didn’t use it, regretted it, forcefully ejected the code from a moving vehicle, shed nary a tear. 
> 
> And yet, there’s so many great uses for `method_missing` out there. If I may, a few of my favorite

He included [Jim Weirich](http://onestepback.org)'s [Builder::XmlMarkup](http://builder.rubyforge.org/classes/Builder/XmlMarkup.html), which allows for:

{% highlight ruby %}
xml.html :lang => "en" do
  xml.head do
    xml.title("History")
  end
  xml.body do
    xml.comment! "HI"
    xml.h1("Header")
    xml.p("paragraph")
  end
end
{% endhighlight %}

*yielding,*

{% highlight html %}
<html lang="en">
  <head>
    <title>History</title>
  </head>
  <body>
    <!-- HI -->
    <h1>Header</h1>
    <p>paragraph</p>
  </body>
</html>
{% endhighlight %}

Other than `comment!`, None of the methods called on the `xml` object exist, and are instead resolved into element names at runtime.  So we end up with a simple, declarative, XML generation DSL that doesn't care about the schema it's generating.

Hey, that's *useful*.

Introducing [DynamicBuilder](http://github.com/mmonteleone/dynamicbuilder)
--------------------------------------------------------------------------

So, now with C# 4's [dynamic](http://msdn.microsoft.com/en-us/library/dd264736.aspx) type and the [DynamicObject](http://msdn.microsoft.com/en-us/library/system.dynamic.dynamicobject.aspx) class, .NET has a mostly-workable `method_missing` of its own.  And with the help of a smidgen of code that is [DynamicBuilder](http://github.com/mmonteleone/dynamicbuilder), we can accomplish the same API.

You can learn it in five minutes and integrate it into existing code in even less time as it's just a single small class.

### Examples

*Nodes via dynamic invocation*

{% highlight csharp %}
dynamic x = new Xml();

// non-existent "hello" method resolves to a "hello" node at runtime
x.hello("world");
{% endhighlight %}

*yields*

{% highlight xml %}
<hello>world</hello>
{% endhighlight %}

*Attributes via anonymous objects*

{% highlight csharp %}
dynamic x = new Xml();    

// passing an anonymous object resolves to xml attributes
x.user(new { username="jdoe", usertype="admin" }, "John Doe");
{% endhighlight %}

*yields*

{% highlight xml %}
<user username="jdoe" usertype="admin">John Doe</user>
{% endhighlight %}
    
*Nesting via anonymous delegates*

{% highlight csharp %}
dynamic x = new Xml();

// passing an anonymous delegate creates a nested context
x.user(Xml.Fragment(u => {
    u.firstname("John");
    u.lastname("Doe");
    u.email("jdoe@example.org");
    u.phone(new { type="cell" }, "(985) 555-1234");
}));
{% endhighlight %}

*yields*

{% highlight xml %}
<user>
    <firstname>John</firstname>
    <lastname>Doe</lastname>
    <email>jdoe@example.org</email>
    <phone type="cell">(985) 555-1234</phone>
</user>
{% endhighlight %}

*Putting it all together: building an Atom syndication feed*

{% highlight csharp %}
// First let's get some posts from a hypothetical `postRepository`
var posts = postRepository.GetLatest(25);

// now let's build an atom feed dynamically
dynamic xml = new Xml();

// set an xml declaration tag
xml.Declaration();

// create the feed and metadata
xml.feed(new { xmlns = "http://www.w3.org/2005/Atom" }, Xml.Fragment(feed =>
{
    feed.title("Michael's Blog!");
    feed.link(new { href = "http://michaelmonteleone.net" });
    feed.link(new { href = "http://michaelmonteleone.net/feed.xml", rel = "self" });
    feed.author(Xml.Fragment(author =>
    {
        author.name("Michael Monteleone");
        author.email("michael@michaelmonteleone.net");
    }));

    // iterate through the posts, adding them to the feed
    foreach (var post in posts)
    {
        feed.entry(Xml.Fragment(entry =>
        {
            entry.title(post.Title);
            entry.link(new { href = post.PermaLink });
            entry.updated(post.PublishDate);
            entry.content(post.Content);
        }));
    }
}));
{% endhighlight %}

*yields*

{% highlight xml %}
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Michael's Blog!</title>
  <link href="http://michaelmonteleone.net" />
  <link href="http://michaelmonteleone.net/feed.xml" rel="self" />
  <author>
    <name>Michael Monteleone</name>
    <email>michael@michaelmonteleone.net</email>
  </author>
  <entry>
    <title>Third post!</title>
    <link href="http://michaelmonteleone.net/2010/03/01/strike-three" />
    <updated>3/1/2010 12:00:00 AM</updated>
    <content>[...]</content>
  </entry>
  <entry>
    <title>Second post!</title>
    <link href="http://michaelmonteleone.net/2010/25/02/second-post" />
    <updated>2/25/2010 12:00:00 AM</updated>
    <content>[...]</content>
  </entry>
  <entry>
    <title>First post!</title>
    <link href="http://michaelmonteleone.net/2010/02/19/very-first-post" />
    <updated>2/19/2010 12:00:00 AM</updated>
    <content>[...]</content>
  </entry>
</feed>
{% endhighlight %}


Shoulders of Giants
-------------------

Well, that's all nice I guess, but the last thing you want is more XML, right?  What about other .NET XML APIs?  How is this any better?  

### The System.Xml Ghetto

The mean streets.  Power and control meets, well, nothing.  The original `System.Xml` types, with us since the beginning of .NET, can be quite tedious to manipulate directly and have grown anachronistically low-level.

{% highlight csharp %}
// Direct node creation with System.Xml types
XmlDocument doc = new XmlDocument();
XmlElement userElement = doc.CreateElement("user");
doc.AppendChild(userElement);
XmlElement firstNameElement = doc.CreateElement("firstname");
firstNameElement.InnerText = "John";
userElement.AppendChild(firstNameElement);
XmlElement lastNameElement = doc.CreateElement("lastname");
lastNameElement.InnerText = "Doe";
userElement.AppendChild(lastNameElement);
XmlElement emailElement = doc.CreateElement("email");
emailElement.InnerText = "jdoe@example.org";
userElement.AppendChild(emailElement);
doc.Save(Console.Out);

// Xml creation with an XmlTextWriter - maybe sorta better?
XmlTextWriter writer = new XmlTextWriter(Console.Out);
writer.WriteStartElement("user");
writer.WriteElementString("firstname", "John");
writer.WriteElementString("firstname", "Doe");
writer.WriteElementString("email", "jdoe@example.org");
writer.WriteEndElement();
writer.Close();
{% endhighlight %}

While these types still are behind the scenes of all subsequent .NET XML APIs (including DynamicBuilder), their verbose syntaxes mean they are no longer the best option for direct XML creation.
    
### The System.Xml.Serialization Suburbs

Medicated and mostly harmless.  This is an attractive choice when your serializable types map exactly to the XML you wish to generate.  Otherwise, I hope you like creating boilerplate adapter classes just for serialization, or that you actually enjoy XSLT.

{% highlight csharp %}
[Serializable]
public class User
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public string Email { get; set; }
}    

User user = new User();
XmlSerializer x = new XmlSerializer(typeof(User));
x.Serialize(Console.Out, user);    
{% endhighlight %}

DynamicBuilder allows code that is just as terse as a serializable class while still retaining the flexibility of manually generating specific XML content.

### The System.Xml.Linq New Urbanism

Attractive but superficial.  C# 3.0 introduced LINQ to XML, and with it, the `System.Xml.Linq` types.  This revolutionized both the programmatic querying of XML as well as the declarative construction of it via object initialization.

{% highlight csharp %}
XElement user = new XElement("user", 
    new XElement("firstname", "John"),
    new XElement("lastname", "Doe"),
    new XElement("email", "jdoe@exampe.org")
);
{% endhighlight %}

While a significant improvement, it can still be awkward and unnatural to use when the document must be generated logically, as everything must be declared via object initialization.  DynamicBuilder's choice of anonymous delegates over object initialization allows for all manner of imaginable logic to be employed within a single, unified, XML creation block.  Coupled with DynamicBuilder's anonymous object-to-attributes mapping, and the syntax is also much thinner and closer to the resulting markup than nested `XElement` noise.

LINQ to XML is still probably the simplest XML *querying/consumption* mechanism.  Also, `DynamicBuilder.Xml` actually uses `System.Xml.Linq` types internally to model its XML, and can easily expose it via its `ToXElement()` method.

The Catch?
----------

*What about Document Types, Comments, and Namespaces?*

In as much as System.Xml.Linq supports them, so does DynamicBuilder.  Check the [doc](http://github.com/mmonteleone/DynamicBuilder).

*Ok, but what's with that ugly `Xml.Fragment()` thing?*

Well, you got me there.  Dynamic operations in C# 4 can do nearly anything:  method calls, properties, *even executing the dynamic object as a delegate*.  Unfortunately, those dynamic method calls *cannot accept anonymous lambdas*.  Admittedly, this would have been so much better:

{% highlight csharp %}
x.user(u => {
    u.firstname("John");
    u.lastname("Doe");
    u.email("jdoe@example.org");
});
{% endhighlight %}

And it's what Builder does.  Sadly,

    Error: Cannot use a lambda expression as an argument to a dynamically dispatched 
    operation without first casting it to a delegate or expression tree type.
    
And just like that, so many Ruby-ish DSLs will never see the light of day.  Instead we would have to cast the lambda:

{% highlight csharp %}
x.user((Action<dynamic>)(u => {
    u.firstname("John");
    u.lastname("Doe");
    u.email("jdoe@example.org");
}));
{% endhighlight %}

To counteract that ugliness just a bit, the static helper `Xml.Fragment()` hides the cast.

{% highlight csharp %}
x.user(Xml.Fragment(u => {
    u.firstname("John");
    u.lastname("Doe");
    u.email("jdoe@example.org");
}));
{% endhighlight %}

Installation/Usage
------------------

Since it's just a single class, you could simply copy `Xml.cs` directly into your project. It doesn't really warrant the overhead of being a referenced assembly.

1. [Download the source, tests, and example from GitHub](http://github.com/mmonteleone/DynamicBuilder).
2. cd into the project's directory `> build release`
3. Copy `build\Release\Xml.cs` into your own project.  Alternatively, you could add a reference to `DynamicBuilder.dll`.
4. Either modify `Xml.cs` to share your project's namespace, or add the `DynamicBuilder` namespace within your code

To run DynamicBuilder's [xUnit](http://xunit.codeplex.com/) test suite, use

    build test
    
Ongoing
-------

Even if this dynamic hipster jazz isn't your thing, it's always useful to learn from other languages' cultural approaches to solving universal programming problems.

DynamicBuilder is a work in progress.  Please feel free to fork away.  
