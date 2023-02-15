require('dotenv').config();
var axios = require('axios');
var cheerio = require('cheerio');
var express = require('express');
var request = require('request');
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var urlConfig = require('./urlConfig.js');

var frontEndUrl = urlConfig.frontEndUrl;
var client_id = process.env.SPOTIFY_CLIENT_ID;
var client_secret = process.env.SPOTIFY_CLIENT_SECRET;
var redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
var geniusApiKeyEnv = process.env.GENIUS_API_KEY;
var googleApiKeyEnv = process.env.GOOGLE_API_KEY;

var generateRandomString = function (length) {
  var text = '';
  var possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app
  .use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  var scope = 'user-read-private user-read-email user-read-playback-state';
  res.redirect(
    'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

app.get('/callback', function (req, res) {
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      '/#' +
        querystring.stringify({
          error: 'state_mismatch',
        })
    );
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      },
      headers: {
        Authorization:
          'Basic ' +
          new Buffer(client_id + ':' + client_secret).toString('base64'),
      },
      json: true,
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { Authorization: 'Bearer ' + access_token },
          json: true,
        };

        request.get(options, function (error, response, body) {
          console.log(body);
        });

        res.redirect(
          frontEndUrl +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token,
            })
        );
      } else {
        res.redirect(
          frontEndUrl +
            querystring.stringify({
              error: 'invalid_token',
            })
        );
      }
    });
  }
});

app.use(express.json());

app.post('/api/lyrics', async (req, res) => {
  const { trackName, artistName } = req.body;
  const geniusApiKey = geniusApiKeyEnv;
  const response = await fetch(`
  https://api.genius.com/search?q=${trackName}&${artistName}&access_token=${geniusApiKey}`);
  const json = await response.json();
  // console.log('json' + json);
  const lyricsUrl = json.response.hits[0].result.url;
  // console.log('lyricsUrl' + lyricsUrl);
  const response2 = await axios.get(lyricsUrl);
  const $ = cheerio.load(response2.data);
  const lyricsContainer = $('[data-lyrics-container="true"]');
  $('br', lyricsContainer).replaceWith('\n');
  $('a', lyricsContainer).replaceWith((_i, el) => $(el).text());
  lyricsContainer.children().remove();
  const cleanLyrics = (lyrics) => {
    return lyrics
      .replace(/\[[^\]]*\]/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
  };

  let lyrics = cleanLyrics(lyricsContainer.text());
  if (!lyrics) {
    res.send({ lyrics: 'No lyrics found' });
  }
  const googleApiKey = googleApiKeyEnv;
  // console.log('lyrics' + lyrics);
  const targetLanguage = 'en';
  const detectLanguageUrl = `https://translation.googleapis.com/language/translate/v2/detect?q=${lyrics}&key=${googleApiKey}`;
  const detectLanguageResponse = await axios.post(detectLanguageUrl);
  const detectedLanguage =
    detectLanguageResponse.data.data.detections[0][0].language;
  // console.log('detectLanguageResponse' + detectLanguageResponse);
  if (detectedLanguage !== targetLanguage) {
    const translateUrl = `https://translation.googleapis.com/language/translate/v2?q=${lyrics}&target=${targetLanguage}&key=${googleApiKey}`;
    const translateResponse = await axios.post(translateUrl);
    lyrics = cleanLyrics(
      translateResponse.data.data.translations[0].translatedText
    );
  }

  // console.log('lyrics' + lyrics);
  res.send({ lyrics });
});

app.get('/refresh_token', function (req, res) {
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization:
        'Basic ' +
        new Buffer(client_id + ':' + client_secret).toString('base64'),
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        access_token: access_token,
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
