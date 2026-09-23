# Product V1 packaged assets

Only the tokenizer vocabulary and metadata are packaged with the app. The
Tiny Encoder V1 model, Search Seed Bank V2, seed vectors, and the promoted
Search Topic Graph V1 routing extension are downloaded at runtime from:

`https://gitee.com/lcaluckily/NewHuRecommend/tree/master/product-v1/v1`

The V5 source-scoped geometry used by the phone demo is a scoring-time transform
on top of those downloaded Product V1 assets; it does not replace the encoder
model or seed bank with a separately bundled model. Search Topic Graph V1 is the
primary search-routing extension; frozen Seed Router V2 remains the automatic
fallback if the graph assets are unavailable.

Their filenames, sizes, MD5 values, SHA-256 values, and model chunk manifest
are defined in `src/product-v1/runtimeAssets.ts`. Downloaded files are stored
in the app-private `document/product-v1` directory and can be removed from the
Storage Management screen without deleting the user profile or reward data.
