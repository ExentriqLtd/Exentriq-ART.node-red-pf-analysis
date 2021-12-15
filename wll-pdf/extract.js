const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const extractTextFromPDF = async (pdfData) => {

  const pages = [];

  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData, verbosity: 0 });
    const pdfDocument = await loadingTask.promise;
    for (let index = 0; index < pdfDocument.numPages; index++) {
      const pdfPage = await pdfDocument.getPage(index + 1);
      const text = await pdfPage.getTextContent();
      pages.push(text);
    }
    return pages;
  } catch (error) {
    throw(error)
  }

};

module.exports = {
  extractTextFromPDF
};
