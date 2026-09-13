export function hideFriendsDock(pathname: string) {
  return (
    pathname === "/play" ||
    pathname === "/map" ||
    pathname === "/friends" ||
    pathname === "/match" ||
    pathname.startsWith("/match/")
  );
}
