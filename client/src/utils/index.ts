import InitiateSocialAuth from "./initiateSocialAuth";

export { extractErrorMessage } from "./extractErrorMessage";
export { default as PersistAuth } from "./PersistAuth";

export const UseGoogle = () => InitiateSocialAuth("google-oauth2", "google");

export { formatDate } from "./formatDate";
export { capitalizeFirstLetter } from "./capitalizeFirstLetter";

export { getRepliesText } from "./getRepliesText";
export { getViewText } from "./getViewText";
export { sortByDateDescending } from "./sortByDate";
