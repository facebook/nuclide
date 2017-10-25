---
layout: post
title: "Command + Click: You Have One Job"
author: matthewwithanm
---

One of the cool things about Nuclide is that, even though it’s an IDE with a ton
of awesome IDE features, it still belongs to the TextMate/Sublime/Atom lineage
of modern text editors. Unfortunately, sometimes these two things come into
conflict. Such is the case with command click.

See, in the Atom family of editors, command + click (control + click on Windows
and Linux) means multiple cursors. But if you’re coming from an IDE, you’re
probably used to using command + click to jump to a definition (“Hyperclick”).

Since Nuclide is both of these things, we’ve always tried to do both: if you
clicked on something that we could get a definition for, we’d take you to it;
otherwise, we’d let Atom do its default behavior (add another cursor). This way
we only interfered with expected Atom behavior when we knew we were supposed to.
Perfect! Right?

<img src="/static/images/blog/2017-02-27/poll.png" width="400" alt="An internal poll" />

It turns out that, in trying to accommodate everybody, we hadn’t made command +
click predictable to anybody. It’s true: when you command click on something,
you may want to go to its definition. Or you may want to add another cursor. But
nobody wants to sometimes go to its definition and sometimes add a cursor. Sorry
about that.

So as of [v0.207][1] (rolled out last week!), command clicking will always jump
to definition.

# Upgrade Path

We know that these kind of breaking changes are disruptive, so the first time
you command + click, we’ll show you a one-time notification explaining the
situation:

<img src="/static/images/blog/2017-02-27/notification.png" alt="" width="450" />

Don’t despair, multicursor fans!  command + option + click still works! (In
Sublime too.) Or if you really insist on using command + click for multiple
cursors, you can change the  Hyperclick trigger to something else in the Nuclide
package’s settings.

[1]: https://github.com/facebook/nuclide/releases/tag/v0.207.0
