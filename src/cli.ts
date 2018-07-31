import {search, SearchValue} from './search';

const temp = 'require(\'http\')';
run(temp);

async function run(fileContent: string): Promise<SearchValue> {
  const f = search(fileContent);
  return f;
}
