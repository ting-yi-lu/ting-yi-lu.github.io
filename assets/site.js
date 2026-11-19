// Close the "Fun" drop-down when tapping/clicking elsewhere or pressing Escape.
document.addEventListener('click', function (e) {
  document.querySelectorAll('.site-nav details[open]').forEach(function (d) {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.site-nav details[open]').forEach(function (d) { d.removeAttribute('open'); });
  }
});
