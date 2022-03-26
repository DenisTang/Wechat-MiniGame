import canvasContext from "./canvas-context";
const downloadedTextures = {};
const downloadingTextures = {};
const downloadFailedTextures = {};

let hasCheckSupportedExtensions = false;
//不让外部使用
if(typeof window !='undefined' && window.indexedDB){
    Object.defineProperty(window, 'indexedDB', {
        get() { return; },
        set() {},
        enumerable : true,
        configurable : true
    });
}
const err = function(msg){GameGlobal.manager.printErr(msg)};
const PotList = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

const UseDXT5 = false;

const mod = {
    getSupportedExtensions(){
        if(hasCheckSupportedExtensions){
            return GameGlobal.TextureCompressedFormat;
        }
        const list = canvas.getContext(GameGlobal.manager.managerConfig.contextConfig.contextType == 2 ? 'webgl2': 'webgl').getSupportedExtensions();
        if(list.indexOf('WEBGL_compressed_texture_astc')!==-1){
            GameGlobal.TextureCompressedFormat = 'astc';
        }else if(list.indexOf('WEBGL_compressed_texture_etc')!==-1){
            GameGlobal.TextureCompressedFormat = 'etc2';
        }else if(list.indexOf('WEBGL_compressed_texture_pvrtc')!==-1){
            GameGlobal.TextureCompressedFormat = 'pvr';
        }else if(list.indexOf('WEBGL_compressed_texture_s3tc') !==-1 && UseDXT5){
            GameGlobal.TextureCompressedFormat = 'dds';
        }/*else if(list.indexOf('WEBGL_compressed_texture_etc1')!==-1){ //ect1不支持透明通道，先屏蔽
            GameGlobal.TextureCompressedFormat = 'etc1';
        }*/else{
            GameGlobal.TextureCompressedFormat = '';
        }
        if(list.indexOf('WEBGL_compressed_texture_etc')!==-1){
            GameGlobal.TextureEtc2Supported = true;
        }
        if(list.indexOf('WEBGL_compressed_texture_pvrtc')!==-1){
            GameGlobal.TexturePVRTCSupported = true;
        }
        hasCheckSupportedExtensions = true;
        return GameGlobal.TextureCompressedFormat;
    },
    getRemoteImageFile(textureId,path,width,height){
        if(!GameGlobal.TextureCompressedFormat || (GameGlobal.TextureCompressedFormat == 'pvr' && (width != height || PotList.indexOf(width)===-1)) || (GameGlobal.TextureCompressedFormat == 'dds' && (width%4!==0 || height%4!==0))){
            mod.downloadFile(textureId,path,width,height)
        }else{
            mod.requestFile(textureId,path,width,height);
        }
    },
    reTryRemoteImageFile(textureId,path,width,height){
        var cid = textureId;
        if(!downloadFailedTextures[cid]){
            downloadFailedTextures[cid] = {
                count:0,
                textureId,path,width,height
            };
        }
        if(downloadFailedTextures[cid].count > 4){
            return;
        }

        setTimeout(()=>{
            mod.getRemoteImageFile(textureId,path,width,height)
        }, Math.pow(2,downloadFailedTextures[cid].count) * 250);

        downloadFailedTextures[cid].count++;
    },
    requestFile(textureId,path,width,height){
        var cid = textureId;
        var format = GameGlobal.TextureCompressedFormat;
        var url = GameGlobal.manager.assetPath.replace(/\/$/,'')+'/Textures/'+format+'/'+width+"/"+path+'.txt';
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.responseType = 'arraybuffer';
        xmlhttp.open("GET",encodeURI(url),true);
        xmlhttp.onload = function(){
            let res = xmlhttp;
            if(res.status === 200){
                downloadedTextures[cid] = {
                    data:res.response,
                    tmpFile:''
                };
                if(downloadingTextures[cid] instanceof Array){
                    downloadingTextures[cid].forEach(v=>v());
                }else{
                    downloadingTextures[cid] && downloadingTextures[cid]();
                }

                delete downloadingTextures[cid];
                delete downloadFailedTextures[cid];
                delete downloadedTextures[cid].data;
                /*
                const fileManager = wx.getFileSystemManager();
                const tmpFilePath = wx.env.USER_DATA_PATH+"/"+cid+'.txt';
                fileManager.writeFile({
                    filePath:tmpFilePath,
                    data:res.response,
                    success(){
                        downloadedTextures[cid].tmpFile = tmpFilePath;
                    },
                    fail(err){
                        console.error(err,"压缩纹理保存失败！id:"+textureId);
                        delete GameGlobal.DownloadedTextures[cid]
                    }
                }); */
            }else{
                err("压缩纹理下载失败！url:"+url);
                mod.reTryRemoteImageFile(textureId,path,width,height);
            }
        };
        xmlhttp.onerror = function(){
            err("压缩纹理下载失败！url:"+url);
            mod.reTryRemoteImageFile(textureId,path,width,height);
        }
        xmlhttp.send(null);
    },
    downloadFile(textureId,path,width,height){

        var url = GameGlobal.manager.assetPath.replace(/\/$/,'')+'/Textures/png/'+width+"/"+path+'.png';
        var cid = textureId;

        var image = wx.createImage();
        image.crossOrigin = '';
        image.src = encodeURI(url);
        image.onload = function () {
            downloadedTextures[cid] = {
                data:image,
                tmpFile:''
            };
            if(downloadingTextures[cid] instanceof Array){
                downloadingTextures[cid].forEach(v=>v());
            }else{
                downloadingTextures[cid] && downloadingTextures[cid]();
            }
            delete downloadingTextures[cid];
            delete downloadFailedTextures[cid];
            delete downloadedTextures[cid];
        };

        image.onerror = function(){
            mod.reTryRemoteImageFile(textureId,path,width,height);
        };
    },
    readFile(textureId,callback,width,height){
        var cid = textureId;
        const fileManager = wx.getFileSystemManager();
        const filePath = wx.env.USER_DATA_PATH+"/"+cid+'.txt';
        fileManager.readFile({
            filePath,
            success(res){
                if(!GameGlobal.TextureCompressedFormat){
                    var image = wx.createImage();
                    image.src = filePath;
                    image.onload = function () {
                        handleLoaded(image);
                        delete downloadedTextures[cid];
                    }
                }else{
                    handleLoaded();
                    delete downloadedTextures[cid].data;
                }
                function handleLoaded(image){
                    downloadedTextures[cid] = {
                        data:image || res.data,
                        tmpFile:filePath
                    };
                    callback();
                }
            },
            fail(err){
                err(err,"读取压缩纹理失败！id:"+cid);
                handleError();
            }
        });


        function handleError(){
            var path;
            if(type === "Texture"){
                path = GameGlobal.TextureConfig[textureId].p;
            }else{
                path = GameGlobal.SpriteAtlasConfig[textureId].p;
            }
            if(downloadingTextures[cid]){
                downloadingTextures[cid].push(callback);
            }else{
                downloadingTextures[cid] = [callback];
            }
            mod.getRemoteImageFile(textureId,type,path.replace(/\\/g,'/'),width,height);
        }
    }
};

GameGlobal.DownloadedTextures = downloadedTextures;
GameGlobal.TextureCompressedFormat = ''; //支持的压缩格式




export default {
    WXDownloadTexture(id,width,height,callback){
        if(!hasCheckSupportedExtensions){
            mod.getSupportedExtensions();
        }
        const Infos = GameGlobal.TextureConfig;
        if(!Infos[id]){
            return err( "映射id 不存在",id);
        }
        var path = Infos[id].p;
        var cid = id;
        /*
        if(downloadedTextures[cid]){
            if(downloadedTextures[cid].data){
                callback();
            }else{
                mod.readFile(id,type,callback,width,height);
            }
        }else */
        if(downloadingTextures[cid]){
            downloadingTextures[cid].push(callback);
        }else{
            downloadingTextures[cid] = [callback];
            mod.getRemoteImageFile(id,path.replace(/\\/g,'/'),width,height);
        }
    }
}


canvasContext.addCreatedListener(()=>{
    if(GameGlobal.TextureConfig){
        mod.getSupportedExtensions();
        if(GameGlobal.TextureCompressedFormat == '' || GameGlobal.TextureCompressedFormat == "pvr"){
            wx.getSystemInfo({
                success(res){
                    if(res.platform == 'ios'){
                        wx.showModal({
                            title: '提示',
                            content: "当前操作系统版本过低，建议您升级至最新版本。",
                        });
                    }
                }
            });
        }
    }
    wx.onNetworkStatusChange(function(res){
        if(res.isConnected){
            for(var key in downloadFailedTextures){
                var v = downloadFailedTextures[key];
                if(v.count >4){
                    mod.getRemoteImageFile(v.textureId,v.type,v.path,v.width,v.height)
                }
            }
        }
    });
});
