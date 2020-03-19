<?hh // strict
// Copyright 2004-present Facebook. All Rights Reserved.

class WebSupportFormCountryTypeahead extends
  WebAsyncUnauthenticatedEndpointController {

  protected async function genPayload():
      Awaitable<string> {
    $countries = await countries_gen_all();
    return array('countries' => $countries);
  }

  protected function doSomething():
      Awaitable<string> {
    return await $this->genPayload();
  }
}
