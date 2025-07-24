import { Injectable } from '@nestjs/common';

import { InvalidOauthCallbackCode, URLHelper } from '../../../base';
import { OAuthProviderName } from '../config';
import { OAuthProvider, Tokens } from './def';

interface MicrosoftOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface UserInfo {
  id: string;
  mail?: string;
  userPrincipalName?: string;
  displayName: string;
}

@Injectable()
export class MicrosoftOAuthProvider extends OAuthProvider {
  override provider = OAuthProviderName.Microsoft;

  constructor(private readonly url: URLHelper) {
    super();
  }

  getAuthUrl(state: string) {
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${this.url.stringify({
      client_id: this.config.clientId,
      redirect_uri: this.url.link('/oauth/callback'),
      response_type: 'code',
      scope: 'openid email profile User.Read',
      response_mode: 'query',
      ...this.config.args,
      state,
    })}`;
  }

  async getToken(code: string) {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      body: this.url.stringify({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.url.link('/oauth/callback'),
        grant_type: 'authorization_code',
        scope: 'openid email profile User.Read',
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.ok) {
      const msToken = (await response.json()) as MicrosoftOAuthTokenResponse;

      return {
        accessToken: msToken.access_token,
        refreshToken: msToken.refresh_token,
        expiresAt: new Date(Date.now() + msToken.expires_in * 1000),
        scope: msToken.scope,
      };
    } else {
      const body = await response.text();
      if (response.status < 500) {
        throw new InvalidOauthCallbackCode({ status: response.status, body });
      }
      throw new Error(
        `Server responded with non-success status ${response.status}, body: ${body}`
      );
    }
  }

  async getUser(tokens: Tokens) {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    );

    if (response.ok) {
      const user = (await response.json()) as UserInfo;

      return {
        id: user.id,
        avatarUrl: `https://graph.microsoft.com/v1.0/users/${user.id}/photo/$value`,
        email: user.mail || user.userPrincipalName || '',
      };
    } else {
      throw new Error(
        `Server responded with non-success code ${
          response.status
        } ${await response.text()}`
      );
    }
  }
}