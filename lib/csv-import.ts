export type CsvLine = { line: number; values: Record<string,string> };

function delimiterCount(line:string,delimiter:string) {
  let count=0,quoted=false;
  for(let index=0;index<line.length;index+=1){
    if(line[index]==='"'){
      if(quoted&&line[index+1]==='"'){index+=1;continue;}
      quoted=!quoted;
    }else if(line[index]===delimiter&&!quoted)count+=1;
  }
  return count;
}

function parseRecords(text:string,delimiter:string) {
  const records:{line:number;values:string[]}[]=[];let row:string[]=[],cell="",quoted=false,physicalLine=1,recordLine=1;
  for(let index=0;index<text.length;index+=1){
    const char=text[index];
    if(char==='"'){
      if(quoted&&text[index+1]==='"'){cell+='"';index+=1;}
      else quoted=!quoted;
    }else if(char===delimiter&&!quoted){row.push(cell);cell="";}
    else if(char==='\n'||char==='\r'){
      if(char==='\r'&&text[index+1]==='\n')index+=1;
      physicalLine+=1;
      if(quoted){cell+="\n";continue;}
      row.push(cell);cell="";
      if(row.some(value=>value.trim()!==""))records.push({line:recordLine,values:row});
      row=[];recordLine=physicalLine;
    }else cell+=char;
  }
  row.push(cell);
  if(row.some(value=>value.trim()!==""))records.push({line:recordLine,values:row});
  return records;
}

export function parseCsv(text:string):{headers:string[];rows:CsvLine[]} {
  const clean=text.replace(/^\uFEFF/,"");
  const firstLine=clean.split(/\r?\n/,1)[0]??"";
  const delimiter=delimiterCount(firstLine,";")>=delimiterCount(firstLine,",")?";":",";
  const records=parseRecords(clean,delimiter);
  if(records.length<2)throw new Error("O CSV precisa ter uma linha de cabeçalho e pelo menos um registro.");
  const headers=records[0].values.map(value=>value.trim());
  const rows=records.slice(1).map(record=>({
    line:record.line,
    values:Object.fromEntries(headers.map((header,column)=>[header,record.values[column]?.trim()??""])),
  }));
  return {headers,rows};
}

export function normalizeHeader(value:string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}
