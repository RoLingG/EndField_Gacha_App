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
	export class LocalFileStatus {
	    hasOfficial: boolean;
	    hasBilibili: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LocalFileStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasOfficial = source["hasOfficial"];
	        this.hasBilibili = source["hasBilibili"];
	    }
	}

}

export namespace utils {
	
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

