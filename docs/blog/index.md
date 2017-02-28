---
id: blog
title: Blog
layout: blog
---

{% assign posts = site.posts limit 10 %}
{% for post in posts %}
  {% include post.html post=post truncate=true %}
{% endfor %}
