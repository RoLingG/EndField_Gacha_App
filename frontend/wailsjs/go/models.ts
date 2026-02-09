export namespace main {
	
	export class LocalDataResponse {
	    char: string;
	    weapon: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalDataResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.char = source["char"];
	        this.weapon = source["weapon"];
	    }
	}
	export class LoginResponse {
	    hgToken: string;
	    players: model.PlayerBindingInfo[];
	
	    static createFrom(source: any = {}) {
	        return new LoginResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hgToken = source["hgToken"];
	        this.players = this.convertValues(source["players"], model.PlayerBindingInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace model {
	
	export class EndFieldCharInfo {
	    charId: string;
	    charName: string;
	    gachaTs: string;
	    isFree: boolean;
	    isNew: boolean;
	    poolId: string;
	    poolName: string;
	    rarity: number;
	    seqId: string;
	
	    static createFrom(source: any = {}) {
	        return new EndFieldCharInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.charId = source["charId"];
	        this.charName = source["charName"];
	        this.gachaTs = source["gachaTs"];
	        this.isFree = source["isFree"];
	        this.isNew = source["isNew"];
	        this.poolId = source["poolId"];
	        this.poolName = source["poolName"];
	        this.rarity = source["rarity"];
	        this.seqId = source["seqId"];
	    }
	}
	export class EndFieldWeaponInfo {
	    poolId: string;
	    poolName: string;
	    weaponId: string;
	    weaponName: string;
	    weaponType: string;
	    rarity: number;
	    isNew: boolean;
	    gachaTs: string;
	    seqId: string;
	
	    static createFrom(source: any = {}) {
	        return new EndFieldWeaponInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.poolId = source["poolId"];
	        this.poolName = source["poolName"];
	        this.weaponId = source["weaponId"];
	        this.weaponName = source["weaponName"];
	        this.weaponType = source["weaponType"];
	        this.rarity = source["rarity"];
	        this.isNew = source["isNew"];
	        this.gachaTs = source["gachaTs"];
	        this.seqId = source["seqId"];
	    }
	}
	export class LocalArchive {
	    uid: string;
	    timestamp: string;
	    path: string;
	    servers: string[];
	
	    static createFrom(source: any = {}) {
	        return new LocalArchive(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.timestamp = source["timestamp"];
	        this.path = source["path"];
	        this.servers = source["servers"];
	    }
	}
	export class PlayerBindingInfo {
	    uid: string;
	    nickName: string;
	    level: number;
	    channelName: string;
	    isOfficial: boolean;
	    serverType: string;
	
	    static createFrom(source: any = {}) {
	        return new PlayerBindingInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.nickName = source["nickName"];
	        this.level = source["level"];
	        this.channelName = source["channelName"];
	        this.isOfficial = source["isOfficial"];
	        this.serverType = source["serverType"];
	    }
	}
	export class ServerTokens {
	    Official: string;
	    Bilibili: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerTokens(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Official = source["Official"];
	        this.Bilibili = source["Bilibili"];
	    }
	}

}

