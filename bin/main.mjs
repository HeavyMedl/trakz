#!/usr/bin/env node
/* eslint-disable no-unused-expressions */

import { Command } from 'commander/esm.mjs';
import CLI from '../src/cli.mjs';

// TODO: interactive config generator
//  - hostname and token
//  - library section name (Music)
//  - Supported containers: [mp3, flac, etc]
//  - Copy destination
// TODO: validate config
// TODO: Create plex playlist in api
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
  .option('-n, --name <artist name>', 'The artist name')
  .option('-p, --popular', 'Popular tracks from Plex metadata')
  .option('-s, --shuffle', 'Shuffle the order of the resultant playlist')
  .option('-l, --limit <number>', 'Limit to first N tracks')
  .option('-j, --json', 'Return tracks as JSON') // TODO
  .option('-c, --copy [destination]', 'Copy tracks to destination')
  .option(
    '-nt, --normalize-title',
    'Normalizes the track title using Plex metadata',
  )
  .action(
    async ({
      name = undefined,
      popular = false,
      shuffle = false,
      limit = -1,
      copy = undefined,
      normalizeTitle = false,
      json = false,
    }) => {
      const cli = new CLI();
      await cli.init();
      const tracks = popular
        ? await cli.getPopularTracks(name, limit, shuffle)
        : await cli.getAllTracks(name, limit, shuffle);

      if (tracks.length > 0) {
        if (copy) {
          cli.copyTracks(tracks, copy, normalizeTitle);
        } else {
          json ? CLI.stdout(tracks) : CLI.displayTracks(tracks, normalizeTitle);
        }
      } else {
        CLI.stdout('No results, homie.');
      }
    },
  );

program.on('--help', () => {
  process.stdout.write(`
Examples:
  $ setlist artist [--name <artist-name>]\n`);
});

program.parse(process.argv);

// Display help if no command given.
if (!process.argv.slice(2).length) {
  program.help();
}
