// import * as fs from 'fs';
// import * as path from 'path';
// import { AnalyzerService } from '../analyzer/analyzer.service';

// const logFilePath = path.join(__dirname, '../../log.txt');
// const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });

// const originalConsoleLog = console.log;
// console.log = (...args: any[]) => {
//   const message = args
//     .map((arg) =>
//       typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
//     )
//     .join(' ');
//   logStream.write(message + '\n');
//   originalConsoleLog(...args);
// };

// async function main() {
//   const rawJson = fs.readFileSync(
//     path.join(__dirname, '../../test/mock-game.json'),
//     'utf-8',
//   );
//   const parsed = JSON.parse(rawJson);
//   const gameArray: [string, any][] = parsed.game;
//   const gameObj = Object.fromEntries(gameArray);

//   const game_log_raw: string = gameObj.game_log;
//   const game_log = game_log_raw
//     .replace(/\^c\d+/g, '')
//     .replace(/\^n/g, '\n')
//     .split(/\r?\n/)
//     .map((line) => line.trim())
//     .filter(Boolean);

//   const analyzer = new AnalyzerService();
//   const result = analyzer.analyze({
//     line_score: gameObj.line_score,
//     game_log,
//     box_score: gameObj.box_score,
//   });

//   console.dir(result, { depth: null });
// }

// main().finally(() => {
//   logStream.end();
// });
