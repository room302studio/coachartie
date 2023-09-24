import pkg from "../package.json";

const version = ref(pkg.version);

export default function useVersion() {
  return { version };
}
