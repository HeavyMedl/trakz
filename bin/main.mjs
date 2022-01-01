#!/usr/bin/env node
/* eslint-disable no-unused-expressions */

// TODO: all tracks doesn't include singles, EPs, or compilations.
// TODO: interactive config generator
//  - hostname and token
//  - library section name (Music)
//  - Supported containers: [mp3, flac, etc]
//  - Copy destination
// TODO: validate config
// TODO: Create plex playlist in api
// TODO: interactive prompt when user passes no artist or just "trakz", or if
//  user uses "artist" command but no artist
// TODO: Download > Copy?
// TODO: copy tracks is broken if the plex server's path to the data
//  doesn't match the client's path to the data. For example: Perhaps the media
//  lives on a NAS with the path /Media/Music. The plex server mounts the NAS at
//  /Volumes/Media/Music (OSX). If the client mounts the NAS drive at
//  H:\Media\Music (Windows) we can no longer use the source path from the plex
//  server at /Volumes/Media/Music. The source path needs to be overwritable.

import { Command } from 'commander/esm.mjs';
import CLI from '../src/cli.mjs';

/**
 * [async description]
 *
 * @return  {[type]}  [return description]
 */
async function artistAction(command) {
  const {
    name: names = [],
    allArtists = false,
    popular = false,
    shuffle = false,
    limit = -1,
    copy = undefined,
    normalizeTitle = false,
    json = false,
  } = command;
  const cli = new CLI();
  await cli.init();

  // Get the tracks according to what the user specified with options
  let tracks = [];
  if (allArtists) {
    tracks = await cli.getTracksFromAllArtists(popular, limit, shuffle);
  } else {
    tracks = popular
      ? await cli.getPopularTracks(names, limit, shuffle)
      : await cli.getAllTracks(names, limit, shuffle);
  }

  if (tracks.length > 0) {
    // Do something with the resultant tracks
    if (copy) {
      cli.copyTracks(tracks, copy, normalizeTitle);
    } else {
      json ? CLI.stdout(tracks) : CLI.display(tracks, normalizeTitle);
    }
  } else if (names.length === 0) {
    // No artists supplied, show artists available?
    CLI.display(await cli.getArtists());
  } else if (names.length === 1) {
    // If we got here, there were no tracks for the artist supplied.
    // perhaps a typo or case issue? Initiates interactive mode to
    // search for existing artists.
    const { choice } = await CLI.choiceHelper(names[0], await cli.getArtists());
    artistAction({
      ...command,
      name: [choice],
    });
  } else {
    CLI.stdout('No results, homie.');
  }
  return cli;
}

const program = new Command();
program
  .usage('[command] [options]')
  .description('Generates playlists of tracks from a Plex Music library')
  .version(CLI.getVersion());

program
  .command('artist')
  .description('Get tracks for artists')
  .option('-n, --name <artist name...>', 'The artist(s) name(s)')
  .option('-a, --all-artists', 'All artists from the music library')
  .option('-p, --popular', 'Popular tracks from Plex metadata')
  .option('-s, --shuffle', 'Shuffle the order of the resultant playlist')
  .option('-l, --limit <number>', 'Limit to first N tracks of artist')
  .option('-j, --json', 'Return tracks as JSON')
  .option('-c, --copy [destination]', 'Copy tracks to destination')
  .option(
    '-nt, --normalize-title',
    'Normalizes the track title using Plex metadata',
  )
  .action(artistAction);

program.on('--help', () => {
  process.stdout.write(`
Examples:
  $ trakz artist [--name <artist-name>]\n`);
});

program.parse(process.argv);

// Display help if no command given.
if (!process.argv.slice(2).length) {
  program.help();
}
