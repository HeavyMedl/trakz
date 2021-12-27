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
  constructor() {
    this.getConfig = memoize(this.getConfig);
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
  mutate(tracks, { limit = -1, shuffle = false }) {
    const filteredTracks = PlexMusic.getFirstNumOfTracks(
      this.plexMusic.filterSupportedContainers(tracks),
      limit,
    );
    if (shuffle) {
      PlexMusic.shuffle(filteredTracks);
    }
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
   * [description]
   */
  async getAllTracks(title = '', limit = -1, shuffle = false) {
    return this.mutate(await this.plexMusic.getAllTracksByArtistTitle(title), {
      limit,
      shuffle,
    });
  }

  /**
   * [description]
   */
  async getPopularTracks(title = '', limit = -1, shuffle = false) {
    const { ratingKey: artistId } = await this.plexMusic.getArtistByTitle(
      title,
    );
    return this.mutate(await this.plexMusic.getPopularTracks(artistId), {
      limit,
      shuffle,
    });
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
   * [displayTracks description]
   *
   * @param   {undefined[]}  tracks          [tracks description]
   * @param   {[type]}       normalizeTitle  [normalizeTitle description]
   * @param   {[type]}       false           [false description]
   *
   * @return  {[]}                           [return description]
   */
  static displayTracks(tracks = [], normalizeTitle = false) {
    tracks.forEach((track) => {
      CLI.stdout(normalizeTitle ? CLI.getNormalizedTitle(track) : track.file);
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
}
