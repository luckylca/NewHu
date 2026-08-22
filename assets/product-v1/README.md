# Product V1 packaged assets

Only the tokenizer vocabulary and metadata are packaged with the app. The
encoder model, search seed bank, and seed vectors are downloaded at runtime
from:

`https://gitee.com/lcaluckily/NewHuRecommend/tree/master/product-v1/v1`

Their filenames, sizes, MD5 values, SHA-256 values, and model chunk manifest
are defined in `src/product-v1/runtimeAssets.ts`. Downloaded files are stored
in the app-private `document/product-v1` directory and can be removed from the
Storage Management screen without deleting the user profile or reward data.
