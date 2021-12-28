import fs from 'fs';
import fsPromise from 'fs/promises';
import cpFile from 'cp-file';
import path from 'path';
import memoize from 'fast-memoize';
import Limiter from 'async-limiter';
import cliProgress from 'cli-progress';
import PlexMusic from './api.mjs';

export default class CLI {
  /**
   * [constructor description]
   *
   * @return  {[type]}  [return description]
   */
  constructor(options = {}) {
    this.getConfig = memoize(this.getConfig);
    this.supportedContainers = options.supportedContainers || ['mp3', 'flac'];
  }

  /**
   * [init description]
   *
   * @return  {[type]}  [return description]
   */
  async init() {
    const { hostname, token } = await this.getConfig();
    this.plexMusic = new PlexMusic({ hostname, token });
  }

  /**
   * [description]
   */
  filter(tracks, { limit = -1 }) {
    const filteredTracks = CLI.getFirstNumOfTracks(
      this.filterSupportedContainers(tracks),
      limit,
    );
    return filteredTracks;
  }

  /**
   * [description]
   */
  // eslint-disable-next-line class-methods-use-this
  async getConfig() {
    return JSON.parse(await fsPromise.readFile(path.resolve('./config.json')));
  }

  /**
   * [query description]
   *
   * @param   {[type]}  qry  [qry description]
   *
   * @return  {[type]}       [return description]
   */
  async query(qry) {
    return this.plexMusic.query(qry);
  }

  /**
   * [getArtists description]
   *
   * @return  {[type]}  [return description]
   */
  async getArtists() {
    return Object.keys(await this.plexMusic.getArtistMap());
  }

  /**
   * [description]
   */
  async getTracksFromAllArtists(popular = false, limit = -1, shuffle = false) {
    const artists = await this.getArtists();
    return popular
      ? this.getPopularTracks(artists, limit, shuffle)
      : this.getAllTracks(artists, limit, shuffle);
  }

  /**
   * [description]
   */
  async getAllTracks(artists = [], limit = -1, shuffle = false) {
    let tracks = await Promise.all(
      artists.map(async (artist) => this.filter(
        await this.plexMusic.getAllTracksByArtistTitle(artist),
        {
          limit,
        },
      )),
    );
    tracks = tracks.flat();
    if (shuffle) {
      CLI.shuffle(tracks);
    }
    return tracks;
  }

  /**
   * [description]
   */
  async getPopularTracks(artists = [], limit = -1, shuffle = false) {
    let tracks = await Promise.all(
      artists.map(async (artist) => {
        const { ratingKey: artistId } = await this.plexMusic.getArtistByTitle(
          artist,
        );
        return this.filter(await this.plexMusic.getPopularTracks(artistId), {
          limit,
        });
      }),
    );
    tracks = tracks.flat();
    if (shuffle) {
      CLI.shuffle(tracks);
    }
    return tracks;
  }

  /**
   * [copyTracks description]
   *
   * @param   {[type]}  tracks         [tracks description]
   * @param   {[type]}  dest           [dest description]
   * @param   {[type]}  normalizeTitle  [normalizeTitle description]
   *
   * @return  {[type]}                 [return description]
   */
  async copyTracks(tracks, dest, normalizeTitle) {
    let destination = dest;
    if (typeof destination !== 'string') {
      const { copyDestination } = await this.getConfig();
      destination = copyDestination;
    }
    const multibar = CLI.getMultiProgressBar();
    const t = new Limiter({ concurrency: 5 });

    /**
     * [async description]
     *
     * @param   {[type]}  file              [file description]
     * @param   {[type]}  finalDestination  [finalDestination description]
     * @param   {[type]}  size              [size description]
     * @param   {[type]}  done              [done description]
     *
     * @return  {[type]}                    [return description]
     */
    async function performCopy(file, finalDestination, size, done) {
      try {
        const bar = multibar.create(size, 0);
        bar.update(0, {
          file: path.basename(file),
          finalDestination,
        });
        await cpFile(file, finalDestination).on(
          'progress',
          ({ writtenBytes }) => {
            bar.update(writtenBytes, {
              file: path.basename(file),
              finalDestination,
            });
          },
        );
        done();
      } catch (error) {
        process.stderr.write(error);
      }
    }

    tracks.forEach((track, i) => {
      const { file, size } = track;
      const fileName = normalizeTitle
        ? `${(i + 1).toString().padStart(2, '0')}. ${CLI.getNormalizedTitle(
          track,
        )}`
        : path.basename(file);
      const finalDestination = path.resolve(`${destination}/${fileName}`);
      t.push((done) => {
        performCopy(file, finalDestination, size, done);
      });
    });
  }

  /**
   * [supportedContainers description]
   *
   * @param   {undefined[]}  tracks  [tracks description]
   *
   * @return  {[]}                   [return description]
   */
  filterSupportedContainers(tracks = []) {
    return tracks.filter((track) => this.supportedContainers.includes(track.container));
  }

  /**
   * [getNormalizedTitle description]
   *
   * @return  {[type]}  [return description]
   */
  static getNormalizedTitle({
    grandparentTitle,
    parentTitle,
    title,
    container,
  }) {
    return `${grandparentTitle} - ${parentTitle} - ${title}.${container}`;
  }

  /**
   * [display description]
   *
   * @param   {undefined[]}  tracks          [tracks description]
   * @param   {[type]}       normalizeTitle  [normalizeTitle description]
   * @param   {[type]}       false           [false description]
   *
   * @return  {[]}                           [return description]
   */
  static display(items = [], normalizeTitle = false) {
    items.forEach((item) => {
      CLI.stdout(normalizeTitle ? CLI.getNormalizedTitle(item) : item.file || item);
    });
  }

  /**
   * [stdout description]
   *
   * @param   {[type]}  output  [output description]
   *
   * @return  {[type]}          [return description]
   */
  static stdout(output) {
    process.stdout.write(
      typeof output !== 'string' ? `${JSON.stringify(output)}\n` : `${output}\n`,
    );
  }

  /**
   * [getMultiProgressBar description]
   *
   * @return  {[type]}  [return description]
   */
  static getMultiProgressBar() {
    return new cliProgress.MultiBar(
      {
        format:
          'Copying: {bar} {percentage}% | {value}/{total} Bytes | {finalDestination}',
        stopOnComplete: true,
        clearOnComplete: false,
        hideCursor: true,
        barsize: 25,
      },
      cliProgress.Presets.shades_grey,
    );
  }

  /**
   * [getVersion description]
   *
   * @return  {[type]}  [return description]
   */
  static getVersion() {
    const { version } = JSON.parse(
      fs.readFileSync(path.resolve('./package.json')),
    );
    return version;
  }

  /**
   * [description]
   */
  static getFirstNumOfTracks(tracks = [], num = 10) {
    return num === -1 ? tracks : tracks.slice(0, num);
  }

  /**
   * [shuffle description]
   *
   * @param   {[type]}  array  [array description]
   *
   * @return  {[type]}         [return description]
   */
  static shuffle(array) {
    let currentIndex = array.length;
    let randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      // eslint-disable-next-line no-param-reassign
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }

    return array;
  }
}
