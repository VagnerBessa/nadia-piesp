const encoder = new TextEncoder();
const text = "A atividade principal"; // length 21
// In the screenshot: "A atividade princip[9][10]al"
// Where is [9][10] inserted? Before "al".
// "A atividade princip" has 19 characters.
// But wait! Look at the screenshot text:
// "A atividade princip[9][10][11][13][14]al do CPqD é a pesquisa..."
// Why did the citation land before 'al'?
// "A atividade principal" has 21 chars.
// If it was shifted by bytes:
// How many accented characters before this in the output?
// "O Centro de Pesquisa e Desenvolvimento em Telecomunicações (CPqD) é uma instituição independente de direito privado... Sua sede está... O CNPJ da Fundação..."
// Let's count accents:
// Telecomunicações (2 accents: ç, õ) -> 2 bytes shift
// é (1) -> 3
// instituição (2) -> 5
// á (1) -> 6
// São Paulo (ã) -> 7
// Fundação (2) -> 9
// CPqD é (1) -> 10.
// Cumulative shift is around 10 to 12 bytes!!!
// "princip" + "al". "princip" length is 7. "al" is 2.
// The citation was shifted by exactly 2 characters! Wait, 2 characters?
// The actual end of the sentence was "A atividade principal do CPqD é a pesquisa e desenvolvimento experimental em ciências físicas e naturais (CNAE 7210-0/00)."
// So it was supposed to be placed after ")"? Or after "principal"?
// If the support was for the statement "A atividade principal do CPqD é...", the segment might cover exactly up to "principal".
// Length of "A atividade principal" = 21. Shift = maybe the API gave segment ending after "principal"?
