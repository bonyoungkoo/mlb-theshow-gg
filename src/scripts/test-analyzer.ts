import * as fs from 'fs';
import * as path from 'path';
import { AnalyzerService } from '../analyzer/analyzer.service';

async function main() {
  const rawJson = fs.readFileSync(
    path.join(__dirname, '../../test/mock-game.json'),
    'utf-8',
  );
  const parsed = JSON.parse(rawJson);

  // 👇 배열 구조를 object로 변환
  const gameArray: [string, any][] = parsed.game;
  const gameObj = Object.fromEntries(gameArray);

  const analyzer = new AnalyzerService();
  const result = analyzer.analyze({
    line_score: gameObj.line_score,
    game_log: gameObj.game_log,
    box_score: gameObj.box_score,
  });

  console.dir(result, { depth: null });
}

main();
