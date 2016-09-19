# User Documentation for nuclide.io

This directory will contain the user and feature documentation for Nuclide.

### Run the Site Locally

1. Make sure you have [Homebrew](http://brew.sh), Ruby, and [RubyGems](https://rubygems.org/) installed.

   > Ruby >= 2.2 is required for the gems. On the latest versions of Mac OS X, Ruby 2.0 is the
   > default. Use `brew install ruby` (or your preferred upgrade mechanism) to install a newer
   > version of Ruby for your Mac OS X system.

2. Make sure you have [Bundler](http://bundler.io/) installed.

    ```
    # may require sudo
    gem install bundler
    ```
3. Install the project's dependencies

    ```
    bundle install
    ```

    > If you get an error when installing `nokogiri`, you may be running into the problem described
    > in [this nokogiri issue](https://github.com/sparklemotion/nokogiri/issues/1483). You can
    > either `brew uninstall xz` (and then `brew install xz` after the bundle is installed) or
    > `xcode-select --install` (although this may not work if you have already installed command
    > line tools).

4. Run Jekyll's server.

    ```
    bundle exec jekyll serve --incremental
    ```

5. The site will be served from http://localhost:4000.

### Updating the Bundle

The site depends on Github Pages and the installed bundle is based on the `github-pages` gem.
Occasionally that gem might get updated with new or changed functionality. If that is the case,
you can run:

```
bundle update
```

to get the latest packages for the installation.
