# Contributing to Nuclide
We want to make contributing to this project as easy and transparent as
possible. The
[Nuclide license](https://github.com/facebook/nuclide/blob/master/LICENSE) has
certain limitations around distribution. However, this does not affect your
ability to fork the project and make contributions.

## Code of Conduct

Facebook has adopted a Code of Conduct that we expect project participants to adhere to. Please [read the full text](https://code.fb.com/codeofconduct/) so that you can understand what actions will and will not be tolerated.

## Our Development Process
Nuclide is currently developed in Facebook's internal repositories and then
exported out to GitHub by a Facebook team member. We invite you to submit pull
requests directly to GitHub and, after review, these can be merged into the
project.

## Getting Started

Follow this guide to start developing on Nuclide:
https://nuclide.io/docs/advanced-topics/building-from-source/

## atom-ide-ui

atom-ide-ui should be developed in its own repository - see the [CONTRIBUTING.md](
https://github.com/facebook-atom/atom-ide-ui/blob/master/CONTRIBUTING.md)
guide in https://github.com/facebook-atom/atom-ide-ui.

## Pull Requests

1. Fork the repo and create your branch from `master` for core changes, or
`gh-pages` for docs and website changes.
2. If you've added code that should be tested, [add tests](https://github.com/facebook/nuclide/wiki/Tips-for-Testing#writing-tests).
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes by [running `scripts/test`, or run the affected tests individually](https://github.com/facebook/nuclide/wiki/Tips-for-Testing#running-tests).
5. Make sure your JavaScript code lints by using Flow.
6. If you haven't already, complete the Contributor License Agreement ("CLA").

## Contributor License Agreement ("CLA")
In order to accept your pull request, we need you to submit a CLA. You only need
to do this once to work on Nuclide and on Facebook's open source projects.

Complete your CLA here: <https://code.facebook.com/cla>

## Issues
We use GitHub issues to track public bugs. Please ensure your description is
clear and has sufficient instructions to be able to reproduce the issue.

Facebook has a [bounty program](https://www.facebook.com/whitehat/) for the safe
disclosure of security bugs. In those cases, please go through the process
outlined on that page and do not file a public issue.

## Coding Style
* Spaces for indentation rather than tabs - 2 for JavaScript, 4 for Python
* 100 character line length
* See the [project wiki](https://github.com/facebook/nuclide/wiki) for coding
practices and development tips.

## License
By contributing to Nuclide, you agree that your contributions will be licensed
under the license outlined in the LICENSE file in the same directory as this
file. Due to certain limitations on distribution, this should not be considered
an [open source license](https://opensource.org/licenses/alphabetical).
