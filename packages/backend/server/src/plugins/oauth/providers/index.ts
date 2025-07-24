import { AppleOAuthProvider } from './apple';
import { GithubOAuthProvider } from './github';
import { GoogleOAuthProvider } from './google';
import { MicrosoftOAuthProvider } from './microsoft';
import { OIDCProvider } from './oidc';

export const OAuthProviders = [
  GoogleOAuthProvider,
  GithubOAuthProvider,
  MicrosoftOAuthProvider,
  OIDCProvider,
  AppleOAuthProvider,
];
