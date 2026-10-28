import Image from "next/image";
import { Icon } from "./icons";

const artwork: Record<string, {src:string;position:string}> = {
 "counter-strike 2": {src:"/games/counter-strike-2.png",position:"center 40%"},
 "valorant": {src:"/games/valorant.png",position:"center 23%"},
 "league of legends": {src:"/games/league-of-legends.png",position:"center"},
 "left 4 dead 2": {src:"/games/left-4-dead.png",position:"center 24%"},
 "minecraft": {src:"/games/minecraft.png",position:"center 28%"},
};

export function GameIcon({ name }: { name: string }) {
 const image = artwork[name.toLowerCase()];
 if (!image) return <Icon name="game" />;
 return <Image src={image.src} alt="" fill sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" style={{objectFit:"cover",objectPosition:image.position}} />;
}
