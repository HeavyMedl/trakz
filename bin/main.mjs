#!/usr/bin/env node
/* eslint-disable no-unused-expressions */

import { Command } from 'commander/esm.mjs';
import CLI from '../src/cli.mjs';

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
// TODO: If tracks is empty ([]), show the closest match to what the
// user typed.. Perhaps misspelled or case didn't match. Use
// levenshtein algorithm.

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
  .action(
    async ({
      name: names = [],
      allArtists = false,
      popular = false,
      shuffle = false,
      limit = -1,
      copy = undefined,
      normalizeTitle = false,
      json = false,
    }) => {
      const cli = new CLI();
      await cli.init();

      if (names.length === 0) {
        // No artists supplied, show artists available?
        return CLI.display(await cli.getArtists());
      }

      // Get the tracks according to what the user specified with options
      let tracks = [];
      if (allArtists) {
        tracks = await cli.getTracksFromAllArtists(popular, limit, shuffle);
      } else {
        tracks = popular
          ? await cli.getPopularTracks(names, limit, shuffle)
          : await cli.getAllTracks(names, limit, shuffle);
      }

      // Do something with the resultant tracks
      if (tracks.length > 0) {
        if (copy) {
          cli.copyTracks(tracks, copy, normalizeTitle);
        } else {
          json ? CLI.stdout(tracks) : CLI.display(tracks, normalizeTitle);
        }
      } else if (names.length === 1) {
        // If we got here, there were no tracks for the artist supplied.
        // perhaps a typo or case issue? Do we do an interactive mode?
        CLI.stdout('No results, homie.');
      } else {
        CLI.stdout('No results, homie.');
      }
    },
  );

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
