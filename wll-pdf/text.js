const isNumeric = (n) => {
  return !isNaN(parseFloat(n)) && isFinite(n);
};

const getLines = (chunks) => {

  const lines = chunks.reduce((acc, obj) => {

    let line = acc.find(x => Math.abs(x.y - obj.transform[5]) < 4);

    if (obj.str.replace(/[\*º]\s*/, '') !== '') {

      if (!line) {
        line = {
          y: obj.transform[5],
          strings: []
        };
        acc.push(line);
      }
      
      line.strings.push({
        text: obj.str,
        x: obj.transform[4]
      });
    }

    return acc;

  }, []);

  lines.sort((a, b) => {
    return (b.y - a.y);
  })

  for (const line of lines) {
    line.strings.sort((a, b) => {
      return (a.x - b.x)
    });
  }

  return lines;

};

const getStructure = (lines, offsets) => {

  const startIndex = lines.findIndex(x => x.strings[0].text.trim() === 'Metodo');
  if (startIndex > -1) {
    const columns = lines[startIndex].strings.map(x => x.text.trim()).filter(x => x !== 'Metodo' && x !== '');
    const offset = offsets.find(x => x.columns.split(',').map(x => x.trim()).join(',') === columns.join(','));  
    if (!offset) {
      throw('Table format unknown');
    }
    return {
      startIndex,
      offset
    };
  }

  return {
    startIndex,
    offset: null
  };

};

const getValues = (lines, parameters, offset) => {

  const values = [];
  let unknownParameters = [];
  let candidates = [];

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    let parameterCandidate = line.strings.filter(x => x.x > offset.parameter[0] && x.x < offset.parameter[1]).map(x => x.text).join('');
    let parameter = parameters.find(x => x.name.toLowerCase() === parameterCandidate.trim().toLowerCase());

    // parameter name split on multiple lines?
    if (!parameter && parameterCandidate) {
      const filteredParameters = parameters.filter(x => x.name.toLowerCase().startsWith(parameterCandidate.trim().toLowerCase()));
      if (filteredParameters.length > 0 && !parameter) {
        for (let i = 1; i < 5; i++) {
          const nextLine = lines[index + i];
          const segueName = nextLine.strings.filter(x => x.x > offset.parameter[0] && x.x < offset.parameter[1]).map(x => x.text).join('');
          if (segueName != '') {
            parameterCandidate = (parameterCandidate + segueName);
            for (const filteredParameter of filteredParameters) {
              if (parameterCandidate.trim().toLowerCase() === filteredParameter.name.toLowerCase()) {
                parameter = filteredParameter;
                break;
              }
            }
          }
          
        }
      }
    }

    let value = line.strings.filter(x => x.x > offset.result[0] && x.x < offset.result[1]).map(x => x.text).join('').trim();
    if (parameter) {
      if (value) {
        const nextLine = lines[index + 1];
        const segueValue = nextLine.strings.filter(x => x.x > offset.result[0] && x.x < offset.result[1]).map(x => x.text).join('').trim();
        if (segueValue != '') {
          index += 1;
          value += ` ${segueValue}`;
        }
      }

      value = value.replace(',', '.');

      values.push({
        name: parameter.name,
        value: isNumeric(value) ? parseFloat(value) : value
      });

      if (candidates.length > 0) {
        unknownParameters = unknownParameters.concat(candidates);
        candidates = [];
      }

    } else if (value) {
      candidates.push(parameterCandidate);
    }
  }

  return { values, unknownParameters };

};

const getDetails = (lines, headers) => {

  const details = {};

  const left = [];
  const right = [];

  for (const line of lines) {    
    const firstColumn = line.strings.filter(x => x.x < 310).map(x => x.text).join('');
    const secondColumn = line.strings.filter(x => x.x > 310).map(x => x.text).join('');
    if (firstColumn.trim() !== '') {
      left.push(firstColumn);
    }
    if (secondColumn.trim() !== '') {
      right.push(secondColumn);
    }
  }

  const rows = left.concat(right);
  for (const header of headers) {
    const row = rows.map(x => {
      const match = x.match(header.rule);
      if (match) {
        return match.groups;
      }
      return undefined;
    }).filter(x => x !== undefined);

    if (row.length > 0) {

      if (header.name === 'description') {
      // description can span multiple lines... let's assume max 5 lines
      details[header.name] = row[0][header.name];
        const rowIndex = rows.findIndex(x => x.indexOf(row[0][header.name]) > -1);
        for (let index = rowIndex + 1; index < rowIndex + 5; index++) {
          const nextRow = rows[index];
          if (!nextRow.startsWith('Fornitore') && !nextRow.startsWith('Parametro')) {
            details[header.name] += nextRow;
          } else {
            break;
          }
        }
        details[header.name] = details[header.name].trim();
      } else if (header.name.endsWith('_date')) {
        // convert date strings to proper dates
        try {
          const dateParts = row[0][header.name].split('/');
          details[header.name] = +new Date(dateParts[2], dateParts[1] - 1, dateParts[0], 10, 00);
        } catch (error) {
          details[header.name] = null;
        }
      } else {
        details[header.name] = row[0][header.name].trim();
      }
    }
  }

  return details;
    
};

const analyzeText = (pages, headers, offsets, parameters) => {

  const report = {
    number: null,
    report_date: null,
    reception_date: null,
    sample_date: null,
    matrix: null,
    description: null,
    provider: null,
    batch: null,
    parameters: [],
    unknownParameters: []
  };

  for (let index = 0; index < pages.length; index++) {
    const text = pages[index];
    const lines = getLines(text.items);
    try {
      const { startIndex, offset } = getStructure(lines, offsets);        
      if (startIndex > -1 && offset) {
        if (index === 0) {
          const details = getDetails(lines.slice(0, startIndex), headers);
          report.number = details.report;
          report.report_date = details.report_date;
          report.reception_date = details.reception_date;
          report.sample_date = details.sample_date ? details.sample_date : '';
          report.matrix = details.matrix;
          report.description = details.description;
          report.batch = details.batch ? details.batch : '';
          report.provider = details.provider ? details.provider : '';
        }
        const { values, unknownParameters } = getValues(lines.slice(startIndex), parameters, offset);
        report.parameters = report.parameters.concat(values);
        report.unknownParameters = report.unknownParameters.concat(unknownParameters);
      }
    } catch (error) {
      if (index === 0) {
        throw(error);
      }
    }
  }

  return report;

};

module.exports = {
  analyzeText
};
