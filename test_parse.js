const headerLine = "First Name,Last Name,Email,Registration Type,Institution,Country";
const h2 = "First Name	Last Name	Email	Registration Type	Institution	Country";

function test(line, delim) {
  const parseLine = (line) => {
     const result = [];
     let current = '';
     let inQuotes = false;
     for (let i=0; i<line.length; i++) {
       if (line[i] === '"') inQuotes = !inQuotes;
       else if (line[i] === delim && !inQuotes) { result.push(current.trim()); current = ''; }
       else current += line[i];
     }
     result.push(current.trim());
     return result;
  };

  const headers = parseLine(line).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  console.log("Headers parsed:", headers);
  
  let map = { fname: 0, lname: 1, email: 2, type: 3, entity: 4, country: 5 };
  headers.forEach((h, i) => {
      if (h.includes('first')) map.fname = i;
      else if (h.includes('last')) map.lname = i;
      else if (h.includes('email')) map.email = i;
      else if (h.includes('type') || h.includes('reg')) map.type = i;
      else if (h.includes('entity') || h.includes('inst') || h.includes('univ')) map.entity = i;
      else if (h.includes('country')) map.country = i;
  });
  console.log("Map:", map);
}

test(headerLine, ',');
