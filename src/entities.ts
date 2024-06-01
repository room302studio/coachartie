interface Message {
  role: string;
  content: string;
  image?: string;
}

interface Options {
  username: string;
  channel: string;
  guild: string;
  related_message_id?: string;
}
