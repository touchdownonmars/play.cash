const arrayShuffle = require('array-shuffle')
const debug = require('debug')('store')

const api = require('./api')
const entity = require('./entity')

const store = {
  location: {
    name: null,
    params: {},
    pathname: null
  },
  entity: null,
  app: {
    title: null,
    width: 0,
    height: 0,
    hidden: false,
    idle: false
  },
  player: {
    videoId: 'GlCmAC4MHek', // TODO: only use this on iOS, null everywhere else
    playing: true,
    volume: 100,
    playbackRate: 1,

    // not settable (reflects player state)
    time: 0,
    duration: 0,
    buffering: true,

    // extra state
    seeking: false,
    fetchingTrack: false
  },
  playlist: {
    shuffle: false,
    repeat: false,
    index: 0,
    tracks: [], // track urls

    // not settable (generated from playlist.tracks)
    tracksShuffled: []
  },
  artists: {},
  searches: {},
  lastSearch: '',
  charts: {
    topArtistUrls: [],
    topTrackUrls: []
  },
  errors: []
}

const SKIP_DEBUG = [
  'PLAYER_TIMEUPDATE',
  'APP_IDLE',
  'APP_HIDDEN',
  'APP_RESIZE'
]

function dispatch (type, data) {
  if (!SKIP_DEBUG.includes(type)) {
    debug('%s %o', type, data)
  }

  switch (type) {
    /**
     * LOCATION
     */

    case 'LOCATION_PUSH': {
      const pathname = data
      if (pathname !== store.location.pathname) window.loc.push(pathname)
      return
    }

    case 'LOCATION_REPLACE': {
      const pathname = data
      if (pathname !== store.location.pathname) window.loc.replace(pathname)
      return
    }

    case 'LOCATION_CHANGE': {
      const location = data
      store.location = location
      store.entity = entity.decode(location.pathname)
      window.ga('send', 'pageview', location.pathname)
      return update()
    }

    /**
     * APP
     */

    case 'APP_TITLE': {
      store.app.title = data
      return update()
    }

    case 'APP_HIDDEN': {
      store.app.hidden = data
      return update()
    }

    case 'APP_RESIZE': {
      store.app.width = data.width
      store.app.height = data.height
      return update()
    }

    case 'APP_IDLE': {
      store.app.idle = data
      return update()
    }

    /**
     * PLAYER
     */

    case 'PLAYER_ERROR': {
      const err = data
      return addError(err)
    }

    case 'PLAYER_ENDED': {
      if (store.playlist.repeat) {
        window.player.seek(0)
      } else {
        store.dispatch('PLAYLIST_NEXT')
      }
      window.ga('send', 'event', 'video', 'ended')
      return update()
    }

    case 'PLAYER_PLAYING': {
      store.player.playing = data
      return update()
    }

    case 'PLAYER_BUFFERING': {
      store.player.buffering = true
      // HACK: fix player emitting 'paused' when loading a new video and getting
      // stuck on loading page (race condition, only happens sometimes)
      dispatch('PLAYER_PLAYING', true)
      return update()
    }

    case 'PLAYER_DURATION': {
      store.player.duration = data
      return update()
    }

    case 'PLAYER_TIMEUPDATE': {
      store.player.time = data
      store.player.buffering = false
      store.player.seeking = false
      return update()
    }

    case 'PLAYER_SEEK': {
      store.player.time = data
      window.player.seek(store.player.time)
      store.player.seeking = true
      return update()
    }

    /**
     * PLAYLIST
     */

    case 'PLAYLIST_SET': {
      const { index, tracks } = data
      store.playlist.index = index
      store.playlist.tracks = tracks
      store.playlist.tracksShuffled = arrayShuffle(store.playlist.tracks.slice(0))
      store.dispatch('PLAYLIST_PLAY_CURRENT')
      return update()
    }

    case 'PLAYLIST_SHUFFLE': {
      let oldTracks
      let newTracks

      if (store.playlist.shuffle) {
        oldTracks = store.playlist.tracksShuffled
        newTracks = store.playlist.tracks
      } else {
        oldTracks = store.playlist.tracks
        newTracks = store.playlist.tracksShuffled
      }

      const currentTrackUrl = oldTracks[store.playlist.index]
      store.playlist.index = newTracks.indexOf(currentTrackUrl)
      store.playlist.shuffle = data
      return update()
    }

    case 'PLAYLIST_REPEAT': {
      store.playlist.repeat = data
      return update()
    }

    case 'PLAYLIST_PREVIOUS': {
      if (store.playlist.tracks.length === 0) return
      store.playlist.index -= 1
      store.playlist.index %= store.playlist.tracks.length
      store.dispatch('PLAYLIST_PLAY_CURRENT')
      return update()
    }

    case 'PLAYLIST_NEXT': {
      if (store.playlist.tracks.length === 0) return
      store.playlist.index += 1
      store.playlist.index %= store.playlist.tracks.length
      store.dispatch('PLAYLIST_PLAY_CURRENT')
      return update()
    }

    case 'PLAYLIST_PLAY_CURRENT': {
      const tracks = store.playlist.shuffle
        ? store.playlist.tracksShuffled
        : store.playlist.tracks

      const trackUrl = tracks[store.playlist.index]
      const track = entity.decode(trackUrl)
      addTrack(track)

      if (store.location.name === 'track') {
        store.dispatch('LOCATION_REPLACE', track.url)
      }

      store.dispatch('FETCH_VIDEO', track)
      store.dispatch('FETCH_TRACK_INFO', track)
      return
    }

    /**
     * SEARCH
     */

    case 'SEARCH_INPUT': {
      const q = data

      const lastSearch = store.lastSearch
      store.lastSearch = q

      if (q === '') {
        store.dispatch('LOCATION_REPLACE', '/')
      } else if (store.location.name === 'search') {
        const searchUrl = entity.encode({ type: 'search', q })
        if (q !== lastSearch) store.dispatch('LOCATION_REPLACE', searchUrl)
      } else {
        const searchUrl = entity.encode({ type: 'search', q })
        store.dispatch('LOCATION_PUSH', searchUrl)
      }

      return update()
    }

    case 'FETCH_SEARCH': {
      api.music({
        method: 'search',
        artistsLimit: 12,
        albumsLimit: 18,
        tracksLimit: 6,
        ...data
      }, (err, result) => {
        dispatch('FETCH_SEARCH_DONE', { err, result })
      })
      return
    }
    case 'FETCH_SEARCH_DONE': {
      const { err, result } = data
      if (err) return addError(err)
      const search = result.result
      addSearch(search)
      return update()
    }

    /**
     * ALBUM
     */

    case 'FETCH_ALBUM_INFO': {
      api.music({ method: 'albumInfo', ...data }, (err, result) => {
        dispatch('FETCH_ALBUM_INFO_DONE', { err, result })
      })
      return
    }
    case 'FETCH_ALBUM_INFO_DONE': {
      const { err, result } = data
      if (err) return addError(err)

      const album = result
      addAlbum(album)

      return update()
    }

    /**
     * ARTIST
     */

    case 'FETCH_ARTIST_INFO': {
      api.music({ method: 'artistInfo', ...data }, (err, result) => {
        dispatch('FETCH_ARTIST_INFO_DONE', { err, result })
      })
      return
    }
    case 'FETCH_ARTIST_INFO_DONE': {
      const { err, result } = data
      if (err) return addError(err)

      const artist = result
      addArtist(artist)

      return update()
    }

    case 'FETCH_ARTIST_TOP_ALBUMS': {
      api.music({ method: 'artistTopAlbums', ...data }, (err, result) => {
        dispatch('FETCH_ARTIST_TOP_ALBUMS_DONE', { err, result })
      })
      return
    }
    case 'FETCH_ARTIST_TOP_ALBUMS_DONE': {
      const { err, result } = data
      if (err) return addError(err)

      const albums = result.result
      addAlbums(albums)

      const artist = addArtist({ type: 'artist', name: result.meta.query.name })
      artist.topAlbumUrls = albums.map(album => album.url)

      return update()
    }

    case 'FETCH_ARTIST_TOP_TRACKS': {
      api.music({ method: 'artistTopTracks', ...data }, (err, result) => {
        dispatch('FETCH_ARTIST_TOP_TRACKS_DONE', { err, result })
      })
      return
    }
    case 'FETCH_ARTIST_TOP_TRACKS_DONE': {
      const { err, result } = data
      if (err) return addError(err)

      const tracks = result.result
      addTracks(tracks)

      const artist = addArtist({ type: 'artist', name: result.meta.query.name })
      artist.topTrackUrls = tracks.map(track => track.url)

      return update()
    }

    /**
     * CHART
     */

    case 'FETCH_CHART_TOP_ARTISTS': {
      api.music({ method: 'chartTopArtists', ...data }, (err, result) => {
        dispatch('FETCH_CHART_TOP_ARTISTS_DONE', { err, result })
      })
      return
    }
    case 'FETCH_CHART_TOP_ARTISTS_DONE': {
      const { err, result } = data
      if (err) return addError(err)

      const artists = result.result
      addArtists(artists)
      store.charts.topArtistUrls = artists.map(artist => artist.url)

      return update()
    }

    case 'FETCH_CHART_TOP_TRACKS': {
      api.music({ method: 'chartTopTracks', ...data }, (err, result) => {
        dispatch('FETCH_CHART_TOP_TRACKS_DONE', { err, result })
      })
      return
    }
    case 'FETCH_CHART_TOP_TRACKS_DONE': {
      const { err, result } = data
      if (err) return addError(err)

      const tracks = result.result
      addTracks(tracks)

      store.charts.topTrackUrls = tracks.map(track => track.url)

      return update()
    }

    /**
     * TRACK
     */

    case 'FETCH_TRACK_INFO': {
      api.music({ method: 'trackInfo', ...data }, (err, result) => {
        dispatch('FETCH_TRACK_INFO_DONE', { err, result })
      })
      return
    }
    case 'FETCH_TRACK_INFO_DONE': {
      const { err, result } = data
      if (err) return addError(err)

      const track = result
      addTrack(track)

      return update()
    }

    case 'FETCH_VIDEO': {
      const track = data
      const { name, artistName } = track
      api.video({ name, artistName }, (err, result) => {
        dispatch('FETCH_VIDEO_DONE', { err, result })
      })
      store.player.fetchingTrack = true
      return update()
    }
    case 'FETCH_VIDEO_DONE': {
      const { err, result } = data
      if (err) return addError(err)

      const { videos } = result
      const video = videos[0]

      if (!video) return store.errors.push(new Error('No track found'))

      const videoId = video.id
      if (videoId !== store.player.videoId) {
        store.player.videoId = videoId
        store.player.time = 0
        store.player.duration = 0
        store.player.buffering = true
        store.player.playing = true
        window.ga('send', 'event', 'video', 'play')
      }
      store.player.fetchingTrack = false
      return update()
    }

    case 'FETCH_FACTS': {
      const track = data
      const { name, artistName, url } = track
      api.facts({ name, artistName }, (err, result) => {
        dispatch('FETCH_FACTS_DONE', { err, result, trackUrl: url })
      })
      return
    }
    case 'FETCH_FACTS_DONE': {
      const { err, result, trackUrl } = data
      if (err) return addError(err)

      const { facts } = result
      addFacts(facts, trackUrl)

      return update()
    }

    default: {
      throw new Error('Unrecognized dispatch type: ' + type)
    }
  }
}

function addError (err) {
  store.errors.push(err)
  update()
}

function addArtist (artist) {
  if (artist.type !== 'artist') throw new Error('Invalid artist')
  if (!artist.url) artist.url = entity.encode(artist)

  const artistDefaults = {
    images: [],
    albums: {},
    tracks: {},
    topTrackUrls: [],
    topAlbumUrls: [],
    similar: []
  }

  let similar = null
  if (artist.similar) {
    addArtists(artist.similar)
    similar = artist.similar.map(similarArtist => similarArtist.url)
  }

  store.artists[artist.url] = Object.assign(
    artistDefaults,
    store.artists[artist.url],
    artist,
    similar && { similar }
  )
  return store.artists[artist.url]
}

function addArtists (artists) {
  return artists.map(addArtist)
}

function addAlbum (album) {
  if (album.type !== 'album') throw new Error('Invalid album')
  if (!album.url) album.url = entity.encode(album)

  const albumDefaults = {
    images: [],
    tracks: []
  }

  const artist = addArtist({ type: 'artist', name: album.artistName })
  artist.albums[album.url] = Object.assign(
    albumDefaults,
    artist.albums[album.url],
    album
  )
  return artist.albums[album.url]
}

function addAlbums (albums) {
  return albums.map(addAlbum)
}

function addTrack (track) {
  if (track.type !== 'track') throw new Error('Invalid track')
  if (!track.url) track.url = entity.encode(track)

  const trackDefaults = {
    images: [],
    facts: []
  }

  const artist = addArtist({ type: 'artist', name: track.artistName })
  if (track.albumName) {
    addAlbum({
      type: 'album',
      name: track.albumName,
      artistName: track.artistName,
      images: track.images
    })
  }

  artist.tracks[track.url] = Object.assign(
    trackDefaults,
    artist.tracks[track.url],
    track
  )
  return artist.tracks[track.url]
}

function addTracks (tracks) {
  return tracks.map(addTrack)
}

function addSearch (search) {
  if (!search.url) search.url = entity.encode(search)

  addArtists(search.artists)
  addTracks(search.tracks)
  addAlbums(search.albums)
  if (search.top) addEntity(search.top)

  store.searches[search.url] = Object.assign(
    store.searches[search.url] || {},
    {
      type: 'search',
      q: search.q,
      artists: search.artists.map(artist => artist.url),
      tracks: search.tracks.map(track => track.url),
      albums: search.albums.map(album => album.url),
      top: search.top && search.top.url
    }
  )
  return store.searches[search.url]
}

function addFacts (facts, trackUrl) {
  const track = addTrack(entity.decode(trackUrl))
  track.facts = facts
  return facts
}

function addEntity (entity) {
  if (entity.type === 'artist') addArtist(entity)
  if (entity.type === 'track') addTrack(entity)
  if (entity.type === 'album') addAlbum(entity)
}

let updating = false

function update () {
  if (updating) return
  // Support calls to dispatch() during an update(), but don't recurse infinitely
  updating = true; store.update(); updating = false
}

// Add `dispatch()` function. Not enumerable (not app data). Not writable (prevent accidents).
Object.defineProperty(store, 'dispatch', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: dispatch
})

// Add `update()` function. Should be overwritten. Not enumerable (not app data).
Object.defineProperty(store, 'update', {
  configurable: false,
  enumerable: false,
  writable: true,
  value: () => { throw new Error('Missing expected `store.update` function') }
})

// Prevent unexpected properties from being added to `store`. Also, prevent existing
// properties from being "configured" (changed to getter/setter, made non-enumerable, etc.)
Object.seal(store)

module.exports = store
