import React, { useState, useEffect } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import urlConfig from './urlConfig.js';

const spotifyApi = new SpotifyWebApi();

const getTokenFromUrl = () => {
  return window.location.hash
    .substring(1)
    .split('&')
    .reduce((initial, item) => {
      let parts = item.split('=');
      initial[parts[0]] = decodeURIComponent(parts[1]);
      return initial;
    }, {});
};

function Login() {
  const [spotifyToken, setSpotifyToken] = useState('');
  const [nowPlaying, setNowPlaying] = useState({});
  const [loggedIn, setLoggedIn] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenData = getTokenFromUrl();
    const spotifyToken = tokenData.access_token;
    window.location.hash = '';

    if (spotifyToken) {
      setSpotifyToken(spotifyToken);
      spotifyApi.setAccessToken(spotifyToken);
      spotifyApi.getMe().then((user) => {
        console.log(user);
      });
      setLoggedIn(true);
    }
  }, []);

  const fetchLyrics = async (trackName, artistName) => {
    try {
      setLoading(true);
      const response = await fetch(urlConfig.fetchLyricsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trackName, artistName }),
      });
      const { lyrics } = await response.json();
      setLyrics(lyrics);
    } catch (error) {
      console.error(error);
      setLyrics('');
    } finally {
      setLoading(false);
    }
  };

  const getNowPlaying = async () => {
    try {
      setLyrics('');
      const response1 = await spotifyApi.getMyCurrentPlaybackState();
      setNowPlaying({
        name: response1.item.name,
        albumArt: response1.item.album.images[0].url,
        artist: response1.item.artists[0].name,
      });

      await fetchLyrics(response1.item.name, response1.item.artists[0].name);
    } catch (error) {
      console.error(error);
      setNowPlaying({});
    }
  };

  return (
    <div className="bg-[#1c1c1c] h-screen">
      {!loggedIn && (
        <div className="h-screen flex flex-col items-center justify-center">
          <div>
            <h1 className="text-white text-2xl py-4 font-large font-bold h-24">
              Welcome to SongSense
            </h1>
          </div>
          <div>
            <h3 className="text-white text-center text-2xl pb-11 font-small">
              A place where songs begin to make sense
            </h3>
          </div>
          <a
            href={urlConfig.loginLyricsUrl}
            className="bg-[#1DB954] hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-2xl w-[50]"
          >
            Login to Spotify
          </a>
        </div>
      )}
      {loggedIn && (
        <div>
          {lyrics ? (
            <div className="grid grid-cols-2 items-center">
              <div>
                <div className="flex items-center justify-center  mt-6">
                  <img src={nowPlaying.albumArt} className="h-48" />
                </div>
              </div>
              <div>
                <div className="w-full max-w-sm text-white">
                  <div className="text-center text-2xl">{nowPlaying.name}</div>
                  <div className="text-center text-lg">{nowPlaying.artist}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className=" h-32 justify-center pt-6 text-lg flex flex-col items-center font-bold text-white">
              Click on the Sync button
            </div>
          )}
          <div>
            <div className="text-white m-11 text-lg items-center justify-center">
              {lyrics}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center mt-4">
            <button
              className=" bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
              onClick={() => getNowPlaying()}
            >
              Sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default Login;
