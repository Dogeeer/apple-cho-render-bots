function createHostFailover({ primaryHost, secondaryHost, tertiaryHost, log = () => {} }) {
  const primary = String(primaryHost || '').trim();
  const secondary = String(secondaryHost || '').trim();
  const tertiary = String(tertiaryHost || '').trim();
  const hosts = [primary, secondary, tertiary]
    .filter((host, index, allHosts) => host && allHosts.indexOf(host) === index);
  let activeIndex = 0;
  let failureHandledForAttempt = false;

  function beginAttempt() {
    failureHandledForAttempt = false;
    return currentHost();
  }

  function currentHost() {
    return hosts[activeIndex] || primary;
  }

  function markConnectFailureBeforeLogin() {
    if (failureHandledForAttempt) return currentHost();
    failureHandledForAttempt = true;
    if (hosts.length < 2) return currentHost();
    activeIndex = (activeIndex + 1) % hosts.length;
    const label = ['primary', 'secondary', 'tertiary'][activeIndex] || `fallback ${activeIndex}`;
    log(`[BOT] Connection failed before login. Switching to ${label} host ${currentHost()}.`);
    return currentHost();
  }

  function markConnected() {
    failureHandledForAttempt = true;
    activeIndex = 0;
    return currentHost();
  }

  function handleConnectErrorBeforeLogin({ loginDone, disconnect } = {}) {
    if (loginDone || failureHandledForAttempt) return false;
    markConnectFailureBeforeLogin();
    if (typeof disconnect === 'function') disconnect();
    return true;
  }

  return {
    beginAttempt,
    currentHost,
    handleConnectErrorBeforeLogin,
    markConnectFailureBeforeLogin,
    markConnected,
  };
}

module.exports = { createHostFailover };
