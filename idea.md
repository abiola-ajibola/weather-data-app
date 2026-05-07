- No need to login/sign out
    * Let the page for creating tokens just display means to create tokens, without login in, but the tokens be saved with the credentials.
    * When a new token is created with the same credentials, revoke existing tokens.
    * Revoke tokens if they've not been used to 30 days.
    * Remove auth based navs from the header, place a small link in the footer to open the auth page
    * no need to store the token in local storage, the token will be used from a proxy server