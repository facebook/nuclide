# Nuclide

[Nuclide](http://nuclide.io/) is a collection of packages for [Atom](https://atom.io/)
to provide IDE-like functionality for a variety of programming languages and
technologies.

---

**Under heavy refactor... check back very soon.**

We're in the process of "unifying" Nuclide under a single package. This greatly improves performance, and makes installing easier. Because we sync our internal code almost immediately with GitHub, you'll witness this transformation as it happens. :)

If you're feeling intrepid and want to try it out - at your own risk - then:

1. Remove any previously installed Nuclide packages.

2. Install the new stuff.

  ```sh
  $ git clone https://github.com/facebook/nuclide.git
  $ cd nuclide
  $ npm install
  $ apm link
  ```

3. Open Atom – now there is only one Nuclide package.
