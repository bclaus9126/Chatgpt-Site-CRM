// Explicit statements become review proposals; these never write structured CRM fields.
export function realEstateProposals(text:string){
 const proposals:{category:string;title:string;fieldName:string;fieldValue:string;sourceExcerpt:string;needsReview?:boolean}[]=[];
 const price=text.match(/(?:dropping|drop|lowering|lower|reducing|reduce)(?:\s+\w+){0,5}\s+(?:to|at)\s*\$?([\d,]+(?:\.\d+)?)(k)?/i);
 if(price){const value=Number(price[1].replaceAll(',',''))*(price[2]?1000:1);if(value>=10000)proposals.push({category:'TRANSACTION INTELLIGENCE',title:`Change current price to $${value.toLocaleString()}`,fieldName:'current_price',fieldValue:String(value),sourceExcerpt:text.slice(0,240)});}
 const beds=text.match(/(?:need|want|looking for)(?:\s+\w+){0,3}\s+(one|two|three|four|five|six|\d+)\s+bedrooms?/i);
 if(beds){const value=({one:1,two:2,three:3,four:4,five:5,six:6} as Record<string,number>)[beds[1].toLowerCase()]||Number(beds[1]);if(value>0)proposals.push({category:'BUYER INTELLIGENCE',title:`Needs ${value} bedrooms`,fieldName:'bedrooms_needed',fieldValue:String(value),sourceExcerpt:text.slice(0,240)});}
 return proposals;
}
