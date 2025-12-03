#!/bin/bash

PROTO_DIR=$OUT_DIR/protobuf
GRAPHQL_DIR=$OUT_DIR/graphql
VERSION_PATH=$OUT_DIR/version.json
MAIN_PATH=$OUT_DIR/main.json
JID_PATH=$OUT_DIR/jid.json
BINARY_PATH=$OUT_DIR/binary.json
MESSAGE_PATH=$OUT_DIR/message.json

OUT=$OUT_DIR/dist/nodejs
PROTO_OUT=$OUT/proto
GRAPHQL_OUT=$OUT/graphql
JID_OUT=$OUT/jid
BINARY_OUT=$OUT/binary
MESSAGE_OUT=$OUT/message

setup() {
    echo "Installing dependencies..."
    npm install -g typescript uglify-js @bufbuild/protoc-gen-es@1.10.0
    
    echo "Cleaning and creating out directory..."
    rm -rf $OUT
    mkdir -p $OUT
    
    echo "Setup completed"
}

copy_assets() {
    echo "Coping assets..."
    
    cp -r assets/* $OUT/
    
    echo "Assets copied"
}

generate_package() {
    echo "Copying package files..."
    cp package.json $OUT/package.json
    cp readme.md $OUT/readme.md

    if [ -n "$PREVIEW_VERSION" ]; then
        echo "Injecting preview version $PREVIEW_VERSION..."
        sed -i 's/{{WA_VERSION}}/'"$PREVIEW_VERSION"'/g' $OUT/package.json
        sed -i 's/{{WA_VERSION}}/'"$PREVIEW_VERSION"'/g' $OUT/readme.md
    else
        echo "Injecting version $NEWEST_VERSION..."
        sed -i 's/{{WA_VERSION}}/'"$NEWEST_VERSION"'/g' $OUT/package.json
        sed -i 's/{{WA_VERSION}}/'"$NEWEST_VERSION"'/g' $OUT/readme.md
    fi

    echo "Package file generated"
}

generate_main() {
    echo "Generating main constants TypeScript definitions..."
    
    node $(dirname "$0")/scripts/generate.js "$VERSION_PATH" "$OUT/index.ts" || {
        echo "Error: main constants generation failed"
        exit 1
    }
    
    node $(dirname "$0")/scripts/generate.js "$MAIN_PATH" "$OUT/index.ts" || {
        echo "Error: main constants generation failed"
        exit 1
    }
    
    echo "Main constants generation completed"
}

generate_graphql() {
    echo "Generating GraphQL TypeScript definitions..."
    mkdir -p $GRAPHQL_OUT
    
    node $(dirname "$0")/scripts/generate-graphql.js "$GRAPHQL_DIR" "$GRAPHQL_OUT/index.ts" || {
        echo "Error: GraphQL generation failed"
        exit 1
    }
    
    echo "GraphQL generation completed"
}

generate_jid() {
    echo "Generating JID constants TypeScript definitions..."
    mkdir -p $JID_OUT
    
    node $(dirname "$0")/scripts/generate.js "$JID_PATH" "$JID_OUT/constants.ts" || {
        echo "Error: JID constants generation failed"
        exit 1
    }
    
    echo "JID constants generation completed"
}

generate_binary() {
    echo "Generating binary constants TypeScript definitions..."
    mkdir -p $BINARY_OUT
    
    node $(dirname "$0")/scripts/generate.js "$BINARY_PATH" "$BINARY_OUT/constants.ts" || {
        echo "Error: binary constants generation failed"
        exit 1
    }
    
    echo "Binary constants generation completed"
}

generate_message() {
    echo "Generating message constants TypeScript definitions..."
    mkdir -p $MESSAGE_OUT
    
    node $(dirname "$0")/scripts/generate.js "$MESSAGE_PATH" "$MESSAGE_OUT/constants.ts" || {
        echo "Error: message constants generation failed"
        exit 1
    }
    
    echo "Message constants generation completed"
}

compile_proto() {
    echo "Compiling proto files..."
    mkdir $PROTO_OUT
    
    pids=()
    
    for protoFile in $PROTO_DIR/*.proto; do
        (
            protoc \
            --es_out $PROTO_OUT \
            --es_opt target=ts \
            --proto_path $PROTO_DIR \
            "$protoFile"
        ) &
        pids+=($!)
    done
    
    for pid in "${pids[@]}"; do
        wait $pid || {
            echo "Error: protoc compilation failed"
            exit 1
        }
    done
    
    echo "Proto compilation completed"
}

compile_ts() {
    echo "Compiling TypeScript files..."

    tsFiles=$(find $OUT -type f -name "*.ts")

    tsc $tsFiles \
    --declaration \
    --module node16 \
    --target es2022 \
    --moduleResolution node16 \
    --esModuleInterop \
    --skipLibCheck \
    --types node \
    --outdir $OUT \
    || {
        echo "Error: TypeScript compilation failed"
        exit 1
    }

    echo "TypeScript compilation completed"

    echo "Removing TypeScript source files..."
    rm $tsFiles
}

minify() {
    echo "Minifying JavaScript files..."
    
    pids=()
    
    for filePath in $OUT/**/*.js; do
        (
            uglifyjs $filePath \
            --compress \
            -o "$filePath"
        ) &
        pids+=($!)
    done
    
    for pid in "${pids[@]}"; do
        wait $pid || {
            echo "Error: Minification failed"
            exit 1
        }
    done
    
    echo "Minification completed"
}

set -e

setup
copy_assets
generate_package
generate_main
generate_graphql
generate_jid
generate_binary
generate_message
compile_proto
compile_ts
minify