#!/bin/bash

PROTO_DIR=$OUT_DIR/protobuf
GRAPHQL_DIR=$OUT_DIR/graphql

OUT=$OUT_DIR/dist/nodejs
PROTO_OUT=$OUT/proto
GRAPHQL_OUT=$OUT/graphql

setup() {
    echo "Installing dependencies..."
    npm install -g typescript uglify-js @bufbuild/protoc-gen-es@1.10.0

    echo "Cleaning and creating out directory..."
    rm -rf $OUT
    mkdir -p $OUT

    echo "Setup completed"
}

generate_package() {
    echo "Copying package files..."
    cp package.json $OUT/package.json
    cp readme.md $OUT/readme.md

    echo "Injecting version $NEWEST_VERSION..."
    sed -i 's/{{WA_VERSION}}/'"$NEWEST_VERSION"'/g' $OUT/package.json
    sed -i 's/{{WA_VERSION}}/'"$NEWEST_VERSION"'/g' $OUT/readme.md
}

generate_index() {
    echo "Generating index file..."

    echo "export const VERSION = '$NEWEST_VERSION';" > $OUT/index.ts
    echo "export const BUILD_HASH = '$NEWEST_BUILD_HASH';" >> $OUT/index.ts

    echo "Index file generated"
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
        --module commonjs \
        --target es2022 \
        --noCheck \
        --outdir $OUT \
    || {
        echo "Error: TypeScript compilation failed"
        exit 1
    }

    echo "TypeScript compilation completed"

    echo "Removing TypeScript source files..."
    rm $tsFiles
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
generate_package
generate_index
compile_proto
generate_graphql
compile_ts
minify