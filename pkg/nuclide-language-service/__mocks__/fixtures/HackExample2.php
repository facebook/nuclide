<?hh // strict
// Copyright 2004-present Facebook. All Rights Reserved.

class WebSupportFormCountryTypeahead extends
  WebAsyncUnauthenticatedEndpointController {

  protected function getPayload(): string {
    $countries = await countries_gen_all();
    $x = $this->
    return array('countries' => $countries);
  }

  protected function doSomething($inputText): string {
    return $this->genPayload();
  }
}
