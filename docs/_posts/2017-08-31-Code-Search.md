---
layout: post
title: "Code Search"
author: a20012251
---

One of the missing features in the [Quick Open](/docs/features/quick-open) pane is searching for
code in your current projects. Internally at Facebook, we have a plugin that provides this
functionality but we never offered a similar tool for the open source world. And we've just published this missing feature!!

Now you can use Quick Open (*command + T* on Mac and *control + T* on Windows and Linux) and type any
code you want to look for. You can also explore the *Code Search* tab.

<img src="/static/images/blog/2017-08-31/quick-open.png" width="700" alt="Quick Open" />

Code Search supports [ripgrep](https://github.com/BurntSushi/ripgrep) (rg),
[silversearcher](https://github.com/ggreer/the_silver_searcher) (ag) and
[ack](https://beyondgrep.com/). We recommend ripgrep and ag because they are blazing fast. Sadly,
only ripgrep works properly on Windows. You can configure which tool to use in the Nuclide package
settings under the *nuclide-code-search* tab.

If you don't specifically select a tool, Nuclide will try to use any available one. On Windows, it
will only try rg.

<img src="/static/images/blog/2017-08-31/settings.png" width="700" alt="Settings" />
