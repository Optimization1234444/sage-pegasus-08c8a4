// Identity emails return to the site root by default.
const authParams = new URLSearchParams(location.hash.slice(1));
if (authParams.has('invite_token') || authParams.has('recovery_token')) {
  location.replace('/admin/' + location.hash);
}
