const { Component, h } = require('preact') /** @jsx h */
const c = require('classnames')

const store = require('../store')
const { formatTime } = require('../format')
const {
  getTrack,
  getArtistForTrack,
  getAlbumForTrack,
  getControlsVisible
} = require('../store-getters')

const Album = require('../components/Album')
const Link = require('../components/Link')

class Controls extends Component {
  constructor (props) {
    super(props)

    this._onClickShuffle = this._onClickShuffle.bind(this)
    this._onClickPrevious = this._onClickPrevious.bind(this)
    this._onClickPlayPause = this._onClickPlayPause.bind(this)
    this._onClickNext = this._onClickNext.bind(this)
    this._onClickRepeat = this._onClickRepeat.bind(this)
    this._onClickSeek = this._onClickSeek.bind(this)
  }

  render (props) {
    const { player, playlist, currentTrackUrl } = store

    if (!currentTrackUrl) {
      return null
    }

    const track = getTrack(currentTrackUrl)
    const artist = getArtistForTrack(currentTrackUrl)
    const album = getAlbumForTrack(currentTrackUrl)

    let $nowPlaying = null

    if (track && artist) {
      let $album = null
      if (album) {
        $album = (
          <Album
            class='fl h-100 shadow-2'
            style={{
              width: 54
            }}
            album={album}
            sizeHint='10vw'
            showName={false}
            showArtistName={false}
          />
        )
      }
      $nowPlaying = (
        <div class='cf pv2'>
          {$album}
          <div
            class='fl'
            style={{
              'padding-top': 4,
              'padding-left': 13,
              width: 'calc(100% - 54px)'
            }}
          >
            <div class='truncate pv1'>
              <Link
                class='underline-hover'
                href={track.url}
              >
                {track.name}
              </Link>
            </div>
            <div class='truncate white-70'>
              <Link
                class='underline-hover f7'
                href={artist.url}
              >
                {artist.name}
              </Link>
            </div>
          </div>
        </div>
      )
    }

    const cls = getControlsVisible()
      ? 'animate-slide-in-up animate--fast'
      : 'animate-slide-out-down animate--normal'

    const progress = player.time / (player.duration || Infinity)

    const playPauseIcon = player.playing
      ? 'pause_circle_outline'
      : 'play_circle_outline'

    const iconCls = 'material-icons hover-white grow-large pointer v-top'

    const iconClsEnabled = 'bg-white-20 br-pill pa2'
    const iconClsDisabled = 'ma2'

    const shuffleCls = playlist.shuffle ? iconClsEnabled : iconClsDisabled
    const repeatCls = playlist.repeat ? iconClsEnabled : iconClsDisabled

    return (
      <div
        id='controls'
        class={c('fixed z-2 bottom-0 w-100 shadow-1 ph2 ph3-m ph3-l', cls)}
        style={{
          height: 80,
          paddingTop: 6
        }}
      >
        <div
          class='fl w-30 v-mid'
          style={{
            'min-height': 1
          }}
        >
          {$nowPlaying}
        </div>
        <div class='fl w-40 tc mt1'>
          <div class='mt1'>
            <span class='mr3'>
              <i
                class={c(iconCls, shuffleCls)}
                style={{
                  fontSize: 20
                }}
                onClick={this._onClickShuffle}
              >
                shuffle
              </i>
            </span>
            <i
              class={c('mh2', iconCls)}
              style={{
                fontSize: 24,
                marginTop: 6
              }}
              onClick={this._onClickPrevious}
            >
              skip_previous
            </i>
            <i
              class={c('mh2', iconCls)}
              style={{
                fontSize: 42,
                marginTop: -3
              }}
              onClick={this._onClickPlayPause}
            >
              {playPauseIcon}
            </i>
            <i
              class={c('mh2', iconCls)}
              style={{
                fontSize: 24,
                marginTop: 6
              }}
              onClick={this._onClickNext}
            >
              skip_next
            </i>
            <span class='ml3'>
              <i
                class={c(iconCls, repeatCls)}
                style={{
                  fontSize: 20
                }}
                onClick={this._onClickRepeat}
              >
                repeat
              </i>
            </span>
          </div>
          <div class='cf w-100 mt1'>
            <div
              class='fl f7 white-90 pr2 tr'
              style={{
                width: 40
              }}
            >
              {formatTime(player.time)}
            </div>
            <div
              class='fl bg-white-50 br-pill mt1 overflow-hidden'
              style={{
                width: 'calc(100% - 80px)',
                height: 4
              }}
              onClick={this._onClickSeek}
            >
              <div
                class='bg-white br-pill'
                style={{
                  width: (progress * 100) + '%',
                  height: 4
                }}
              />
            </div>
            <div
              class='fl f7 white-90 pl2 tl'
              style={{
                width: 40
              }}
            >
              {formatTime(player.duration)}
            </div>
          </div>
        </div>
        <div class='fl w-30 v-mid' />
      </div>
    )
  }

  _onClickShuffle () {
    store.dispatch('PLAYLIST_SHUFFLE', !store.playlist.shuffle)
  }

  _onClickPrevious () {
    window.alert('TODO')
  }

  _onClickPlayPause (e) {
    const { player } = store
    store.dispatch('PLAYER_PLAYING', !player.playing)
  }

  _onClickNext () {
    window.alert('TODO')
  }

  _onClickRepeat () {
    store.dispatch('PLAYLIST_REPEAT', !store.playlist.repeat)
  }

  _onClickSeek (e) {
    const { player } = store
    const time = (e.offsetX / e.currentTarget.offsetWidth) * player.duration
    store.dispatch('PLAYER_SEEK', time)
  }
}

module.exports = Controls
