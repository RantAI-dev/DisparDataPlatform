// Stub `echarts-for-react`: merekam prop `option` tiap chart sesuai urutan render, lalu
// tidak merender apa pun. Rekaman dibaca skrip golden lewat globalThis.__rekamanChart.
function ReactEChartsStub(props) {
  (globalThis.__rekamanChart ??= []).push(props.option);
  return null;
}
module.exports = ReactEChartsStub;
module.exports.default = ReactEChartsStub;
module.exports.__esModule = true;
