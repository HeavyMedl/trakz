import PlexAPI from 'plex-api';

export default class PlexMusic {
  constructor(options = {}) {
    const { hostname = '', token = '' } = options;
    this.plexAPI = new PlexAPI({
      hostname,
      token,
      ...options,
    });
  }

  /**
   * [query description]
   *
   * @param   {[type]}  qry  [qry description]
   *
   * @return  {[type]}       [return description]
   */
  async query(qry) {
    return this.plexAPI.query(qry);
  }

  /**
   * [getPopularTracksURL description]
   *
   * @param   {[type]}  artistId  [artistId description]
   *
   * @return  {[type]}            [return description]
   */
  async getPopularTracksURL(artistId) {
    const queryStrings = {
      'album.subformat!=': 'Compilation,Live',
      'artist.id=': artistId,
      'group=': 'title',
      'limit=': '100',
      'ratingCount>=': '1',
      'resolveTags=': '1',
      'sort=': 'ratingCount:desc',
      'type=': '10',
    };
    const { key: sectionId } = await this.getSectionByTitle('Music');
    return `/library/sections/${sectionId}/all?${Object.keys(
      queryStrings,
    ).reduce(
      (str, key, i, arr) => str + key + queryStrings[key] + (i < arr.length - 1 ? '&' : ''),
      '',
    )}`;
  }

  /**
   * [getPopularTracks description]
   *
   * @param   {[type]}  artistId  [artistId description]
   *
   * @return  {[type]}            [return description]
   */
  async getPopularTracks(artistId) {
    const {
      MediaContainer: { Metadata = [] },
    } = await this.plexAPI.query(await this.getPopularTracksURL(artistId));
    return PlexMusic.getTracks(Metadata);
  }

  /**
   * [getSectionByTitle description]
   *
   * @param   {[type]}  title  [title description]
   *
   * @return  {[type]}         [return description]
   */
  async getSectionByTitle(title) {
    const {
      MediaContainer: { Directory },
    } = await this.plexAPI.query('/library/sections');
    return (
      (Directory || []).find(
        ({ title: sectionTitle }) => title === sectionTitle,
      ) || {}
    );
  }

  /**
   * [getArtistMap description]
   *
   * @return  {[type]}  [return description]
   */
  async getArtistMap() {
    const {
      MediaContainer: { Metadata: artists },
    } = await this.getArtists();
    return artists.reduce((map, { title: artist, ratingKey: artistId }) => {
      // eslint-disable-next-line no-param-reassign
      map[artist] = artistId;
      return map;
    }, {});
  }

  /**
   * [getArtists description]
   *
   * @return  {[type]}  [return description]
   */
  async getArtists() {
    const { key } = await this.getSectionByTitle('Music');
    return this.plexAPI.query(`/library/sections/${key}/all`);
  }

  /**
   * [getArtistByTitle description]
   *
   * @param   {[type]}  title  [title description]
   *
   * @return  {[type]}         [return description]
   */
  async getArtistByTitle(title) {
    const { MediaContainer: { Metadata = [] } = {} } = (await this.getArtists()) || {};
    return (
      (Metadata || []).find(
        ({ title: artistTitle }) => title.split(' ').join('').toLowerCase()
          === artistTitle.split(' ').join('').toLowerCase(),
      ) || {}
    );
  }

  /**
   * [getAlbumsByArtistTitle description]
   *
   * @param   {[type]}  title  [title description]
   *
   * @return  {[type]}         [return description]
   */
  async getAlbumsByArtistTitle(title) {
    const { key: childrenPath = '' } = await this.getArtistByTitle(title);
    const { MediaContainer: { Metadata = [] } = {} } = (await this.query(childrenPath)) || {};
    return Metadata;
  }

  /**
   * [getTracks description]
   *
   * @param   {[type]}  trackObjects  [trackObjects description]
   *
   * @return  {[type]}                [return description]
   */
  static getTracks(trackObjects) {
    return (trackObjects || []).reduce(
      (
        acc,
        {
          originalTitle = '',
          parentTitle = '',
          grandparentTitle = '',
          title = '',
          Media = [],
        },
      ) => acc.concat(
        (Media || []).reduce(
          (acc$1, { Part = [] }) => acc$1.concat(
            (Part || []).reduce(
              (acc$2, song = {}) => acc$2.concat({
                parentTitle,
                grandparentTitle,
                originalTitle,
                title,
                ...song,
              }),
              [],
            ),
          ),
          [],
        ),
      ),
      [],
    );
  }

  /**
   * [getAllTracksByArtistTitle description]
   *
   * @param   {[type]}  title  [title description]
   *
   * @return  {[type]}         [return description]
   */
  async getAllTracksByArtistTitle(t) {
    const { ratingKey: artistId = '' } = await this.getArtistByTitle(t);
    if (!artistId) {
      return [];
    }
    const {
      MediaContainer: { Metadata: trackObjects = [] },
    } = await this.query(`/library/metadata/${artistId}/allLeaves`);
    return PlexMusic.getTracks(trackObjects);
  }
}
