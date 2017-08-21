Atom Tabs
=========

This contains code vendored from [atom/tabs](https://github.com/atom/tabs) so
that we can duplicate their appearance and behavior. The necessary classes
aren't (currently) exposed.

To update the code, run the following command in this directory (and update the
version here):

    curl -Lk https://github.com/atom/tabs/archive/v0.106.2.zip -o tmp-atom-tabs.zip \
    && rm -rf "./atom-tabs" \
    && rm -rf "./tmp-atom-tabs" \
    && mkdir ./tmp-atom-tabs \
    && mkdir ./atom-tabs \
    && tar -xvf ./tmp-atom-tabs.zip --strip-components=1 -C ./tmp-atom-tabs \
    && rm -rf "./tmp-atom-tabs.zip" \
    && cp -rp ./tmp-atom-tabs/lib ./atom-tabs \
    && cp -rp ./tmp-atom-tabs/LICENSE.md ./atom-tabs \
    && rm -rf "./tmp-atom-tabs" \
    && coffee -c ./atom-tabs \
    && find ./atom-tabs -name "*.coffee" -delete

You will have to install coffee-script and make sure that `coffee` is on your
path. The version used was 1.12.2.
