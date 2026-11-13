import TetrisGame from '@/components/TetrisGame';
import { readGitLog } from '@/lib/gitlog';

export default function Home() {
  const commits = readGitLog();
  return <TetrisGame commits={commits} />;
}
